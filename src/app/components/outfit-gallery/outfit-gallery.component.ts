import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe, CommonModule, DatePipe, NgForOf, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, timer } from 'rxjs';
import { switchMap, take, pairwise, startWith } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { TutorialService } from '../../services/tutorial.service';
import { GeneratedImage } from '../../models/outfit';
import { SmartGarmentUploadDialogComponent } from '../smart-garment-upload-dialog/smart-garment-upload-dialog.component';
import { ImageEditDialogComponent, ImageEditDialogData, ImageEditDialogResult } from '../image-edit-dialog/image-edit-dialog.component';
import { ArchivePanelComponent } from '../archive-panel/archive-panel.component';
import { AiDisclaimerComponent } from '../shared/ai-disclaimer/ai-disclaimer.component';

@Component({
  selector: 'app-outfit-gallery',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgForOf,
    AsyncPipe,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    ArchivePanelComponent,
    AiDisclaimerComponent
  ],
  templateUrl: './outfit-gallery.component.html',
  styleUrls: ['./outfit-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OutfitGalleryComponent implements OnInit, OnDestroy {
  private readonly outfitService = inject(OutfitService);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly tutorialService = inject(TutorialService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly generatedImages$ = this.outfitService.generatedImages$;
  private readonly subscription = new Subscription();

  // Archive panel state
  readonly isArchivePanelOpen = signal(false);

  // Tutorial state - show return to studio prompt
  readonly isGalleryReturnStep = this.tutorialService.isGalleryReturnStep;

  // Track processing images for banner (#13) and notifications (#22)
  private processingImageIds = new Set<string>();

  // Navigate to studio - completes gallery-return step if in tutorial
  goToStudio(): void {
    // If in tutorial gallery-return step, advance to full walkthrough
    if (this.tutorialService.isGalleryReturnStep()) {
      this.tutorialService.startFullWalkthrough();
      // Trigger change detection to immediately hide the tutorial banner
      this.cdr.markForCheck();
    }
    this.router.navigate(['/studio']);
  }

  /**
   * Check if there are any images currently processing (#13)
   */
  hasProcessingImages(): boolean {
    return this.processingImageIds.size > 0;
  }

  openArchivePanel(): void {
    this.isArchivePanelOpen.set(true);
  }

  closeArchivePanel(): void {
    this.isArchivePanelOpen.set(false);
  }

  onArchiveItemRestored(): void {
    // Refresh the gallery when an item is restored
    this.outfitService.refreshGeneratedImages().pipe(take(1)).subscribe();
  }

  ngOnInit(): void {
    // Poll for updates
    const poll$ = timer(0, 30000)
      .pipe(switchMap(() => this.outfitService.refreshGeneratedImages()))
      .subscribe();
    this.subscription.add(poll$);

    // Track processing images and notify when complete (#22)
    const notify$ = this.generatedImages$.pipe(
      startWith([] as GeneratedImage[]),
      pairwise()
    ).subscribe(([previousImages, currentImages]) => {
      // Update processing set
      const newProcessingIds = new Set<string>();
      currentImages.forEach(img => {
        if (img.status === 'processing' || img.status === 'pending_retry' || img.status === 'failed') {
          // Include 'failed' because the backend may retry failed attempts
          newProcessingIds.add(img.id);
        }
      });

      // Check for newly completed images (was processing, now ready)
      this.processingImageIds.forEach(id => {
        const currentImage = currentImages.find(img => img.id === id);
        if (currentImage && currentImage.status === 'ready') {
          // Image just completed - show notification
          this.snackBar.open('🎉 Your outfit is ready!', 'View', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          }).onAction().subscribe(() => {
            const index = currentImages.findIndex(img => img.id === id);
            if (index >= 0) {
              this.viewImage(currentImage, index);
            }
          });
        }
      });

      this.processingImageIds = newProcessingIds;
    });
    this.subscription.add(notify$);
  }

  viewImage(image: GeneratedImage, index: number): void {
    this.outfitService.setCurrentGalleryIndex(index);
    this.router.navigate(['/review-image', image.id]);
  }

  trackById(_: number, image: GeneratedImage): string {
    return image.id;
  }

  archive(image: GeneratedImage): void {
    this.apiService.archiveOutfit(image.id).pipe(take(1)).subscribe({
      next: () => {
        this.outfitService.removeGeneratedImage(image.id);
        this.snackBar.open('Outfit archived.', 'Dismiss', { duration: 2500 });
      },
      error: () => {
        this.snackBar.open('Failed to archive outfit.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  openUploadDialog(): void {
    this.dialog.open(SmartGarmentUploadDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'garment-upload-dialog',
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
