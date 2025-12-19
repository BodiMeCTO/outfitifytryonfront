import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe, CommonModule, DatePipe, NgForOf, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { GeneratedImage } from '../../models/outfit';

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

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
