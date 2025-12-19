import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { GeneratedImage } from '../../models/outfit';

@Component({
  selector: 'app-image-review',
  standalone: true,
  imports: [CommonModule, NgIf, AsyncPipe, RouterLink, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './image-review.component.html',
  styleUrls: ['./image-review.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageReviewComponent implements OnInit, OnDestroy {
  readonly image = signal<GeneratedImage | undefined>(undefined);
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly outfitService: OutfitService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        return;
      }
      const image = this.outfitService.getGeneratedImageById(id);
      if (image) {
        this.image.set(image);
        return;
      }

      const refreshSub = this.outfitService
        .refreshGeneratedImages()
        .pipe(take(1))
        .subscribe({
          next: (images) => {
            const match = images.find((item) => item.id === id);
            this.image.set(match);
            if (!match) {
              this.snackBar.open('Unable to find that generated outfit. Returning to gallery.', 'Dismiss', {
                duration: 3000
              });
              this.router.navigate(['/generated-gallery']);
            }
          },
          error: () => {
            this.snackBar.open('Unable to load the selected outfit from OutfitifyAPI.', 'Dismiss', {
              duration: 3500
            });
            this.router.navigate(['/generated-gallery']);
          }
        });

      this.subscriptions.add(refreshSub);
    });
    this.subscriptions.add(sub);
  }

  navigate(direction: 1 | -1): void {
    const current = this.image();
    if (!current) {
      return;
    }
    const nextId = this.outfitService.getAdjacentImageId(current.id, direction);
    if (nextId) {
      this.router.navigate(['/review-image', nextId]);
    }
  }

  async share(): Promise<void> {
    const image = this.image();
    if (!image) {
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Outfitify Generated Outfit',
          text: 'Check out this generated outfit I created!',
          url: image.imageUrl
        });
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          this.snackBar.open('Unable to share right now.', 'Dismiss', { duration: 3000 });
        }
      }
    } else {
      this.snackBar.open('Sharing is not supported on this device.', 'Got it', { duration: 3000 });
    }
  }

  download(): void {
    const image = this.image();
    if (!image) {
      return;
    }
    const link = document.createElement('a');
    link.href = image.imageUrl;
    link.download = `uniform-outfit-${image.id}.png`;
    link.click();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
