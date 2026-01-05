import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe, CommonModule, DatePipe, NgForOf, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, timer } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { GeneratedImage } from '../../models/outfit';
import { SmartGarmentUploadDialogComponent } from '../smart-garment-upload-dialog/smart-garment-upload-dialog.component';
import { ImageEditDialogComponent, ImageEditDialogData, ImageEditDialogResult } from '../image-edit-dialog/image-edit-dialog.component';

@Component({
  selector: 'app-outfit-gallery',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgForOf,
    AsyncPipe,
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './outfit-gallery.component.html',
  styleUrls: ['./outfit-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OutfitGalleryComponent implements OnInit, OnDestroy {
  private readonly outfitService = inject(OutfitService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly generatedImages$ = this.outfitService.generatedImages$;
  private readonly subscription = new Subscription();

  ngOnInit(): void {
    const poll$ = timer(0, 30000)
      .pipe(switchMap(() => this.outfitService.refreshGeneratedImages()))
      .subscribe();
    this.subscription.add(poll$);
  }

  viewImage(image: GeneratedImage, index: number): void {
    this.outfitService.setCurrentGalleryIndex(index);
    this.router.navigate(['/review-image', image.id]);
  }

  trackById(_: number, image: GeneratedImage): string {
    return image.id;
  }

  remove(image: GeneratedImage): void {
    this.outfitService.removeGeneratedImage(image.id);
    this.snackBar.open('Outfit removed from gallery.', 'Dismiss', { duration: 2500 });
  }

  openUploadDialog(): void {
    this.dialog.open(SmartGarmentUploadDialogComponent, {
      width: '450px',
      maxWidth: '95vw',
      disableClose: false
    });
  }

  openEditDialog(image: GeneratedImage): void {
    if (image.status !== 'ready') {
      this.snackBar.open('Please wait until the image is ready before enhancing.', 'OK', { duration: 3000 });
      return;
    }

    // Use outfitImageId if available, otherwise fall back to id (for backwards compatibility)
    const imageId = image.outfitImageId ?? image.id;

    if (!image.outfitImageId) {
      console.warn('[OutfitGalleryComponent] No outfitImageId available, using outfit id. Edit may fail.');
    }

    const dialogRef = this.dialog.open(ImageEditDialogComponent, {
      width: '550px',
      maxWidth: '95vw',
      data: {
        outfitImageId: imageId,
        imageUrl: image.imageUrl
      } as ImageEditDialogData
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((result: ImageEditDialogResult | undefined) => {
      if (result?.saved && result.newImage) {
        this.snackBar.open('Image enhanced! Refreshing gallery...', 'OK', { duration: 3000 });
        this.outfitService.refreshGeneratedImages().pipe(take(1)).subscribe();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
