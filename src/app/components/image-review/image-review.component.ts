import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal, computed, inject } from '@angular/core';
import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { GeneratedImage, OutfitImageVariant } from '../../models/outfit';
import { ImageEditDialogComponent, ImageEditDialogData, ImageEditDialogResult } from '../image-edit-dialog/image-edit-dialog.component';
import { AiDisclaimerComponent } from '../shared/ai-disclaimer/ai-disclaimer.component';

@Component({
  selector: 'app-image-review',
  standalone: true,
  imports: [CommonModule, NgIf, AsyncPipe, RouterLink, MatButtonModule, MatIconModule, MatSnackBarModule, MatDialogModule, MatTooltipModule, AiDisclaimerComponent],
  templateUrl: './image-review.component.html',
  styleUrls: ['./image-review.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageReviewComponent implements OnInit, OnDestroy {
  readonly image = signal<GeneratedImage | undefined>(undefined);
  readonly selectedVariantIndex = signal<number>(0);
  private readonly subscriptions = new Subscription();
  private readonly dialog = inject(MatDialog);

  // Computed: get the currently selected variant
  readonly currentVariant = computed(() => {
    const img = this.image();
    if (!img?.variants?.length) return null;
    const index = this.selectedVariantIndex();
    return img.variants[index] ?? img.variants[0];
  });

  // Computed: get the display image URL (from selected variant or fallback)
  readonly displayImageUrl = computed(() => {
    const variant = this.currentVariant();
    if (variant) return variant.imageUrl;
    return this.image()?.imageUrl ?? '';
  });

  // Computed: check if there are multiple variants
  readonly hasVariants = computed(() => {
    const img = this.image();
    return (img?.variants?.length ?? 0) > 1;
  });

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
    // Reset variant selection when navigating to a different outfit
    this.selectedVariantIndex.set(0);
    const nextId = this.outfitService.getAdjacentImageId(current.id, direction);
    if (nextId) {
      this.router.navigate(['/review-image', nextId]);
    }
  }

  // Select a variant by index
  selectVariant(index: number): void {
    this.selectedVariantIndex.set(index);
  }

  // Get display label for a variant
  getVariantLabel(variant: OutfitImageVariant, index: number): string {
    if (!variant.editType) return 'Original';
    switch (variant.editType) {
      case 'filtered': return 'Filtered';
      case 'upscaled': return 'Upscaled';
      case 'filtered_upscaled': return 'Enhanced';
      default: return `Version ${index + 1}`;
    }
  }

  async share(): Promise<void> {
    const imageUrl = this.displayImageUrl();
    if (!imageUrl) {
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Outfitify Generated Outfit',
          text: 'Check out this generated outfit I created!',
          url: imageUrl
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

  async download(): Promise<void> {
    const imageUrl = this.displayImageUrl();
    const variant = this.currentVariant();
    const image = this.image();

    if (!imageUrl || !image) {
      return;
    }

    // Include variant info in filename
    const variantSuffix = variant?.editType ? `-${variant.editType}` : '';
    const filename = `outfitify-outfit-${image.id}${variantSuffix}.png`;

    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Cleanup after a short delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('Download failed:', error);

      // Fallback: Direct link (may just navigate instead of download for cross-origin)
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.snackBar.open('If download didn\'t start, right-click the image to save.', 'Got it', {
        duration: 4000
      });
    }
  }

  /**
   * Download the image with an "AI-Generated Content" watermark
   */
  async downloadWithWatermark(): Promise<void> {
    const imageUrl = this.displayImageUrl();
    const variant = this.currentVariant();
    const image = this.image();

    if (!imageUrl || !image) {
      return;
    }

    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      // Create canvas and draw image
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw the original image
      ctx.drawImage(imageBitmap, 0, 0);

      // Add watermark
      const watermarkText = 'AI-Generated Content';
      const padding = 20;
      const fontSize = Math.max(24, Math.floor(canvas.width / 40)); // Responsive font size

      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textBaseline = 'bottom';

      // Measure text for background
      const textMetrics = ctx.measureText(watermarkText);
      const textWidth = textMetrics.width;
      const textHeight = fontSize * 1.2;

      // Position in bottom-right corner
      const x = canvas.width - textWidth - padding * 2;
      const y = canvas.height - padding;

      // Draw semi-transparent background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x - padding / 2, y - textHeight, textWidth + padding, textHeight + padding / 2);

      // Draw watermark text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(watermarkText, x, y);

      // Convert to blob and download
      canvas.toBlob((watermarkedBlob) => {
        if (!watermarkedBlob) {
          this.snackBar.open('Failed to create watermarked image.', 'Dismiss', { duration: 3000 });
          return;
        }

        const variantSuffix = variant?.editType ? `-${variant.editType}` : '';
        const filename = `outfitify-outfit-${image.id}${variantSuffix}-watermarked.png`;

        const blobUrl = URL.createObjectURL(watermarkedBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 100);

        this.snackBar.open('Downloaded with AI watermark.', 'OK', { duration: 2500 });
      }, 'image/png');

    } catch (error) {
      console.error('Watermark download failed:', error);
      this.snackBar.open('Failed to add watermark. Try regular download instead.', 'Dismiss', {
        duration: 4000
      });
    }
  }

  openEditDialog(): void {
    const variant = this.currentVariant();
    const image = this.image();

    if (!image) {
      return;
    }

    // Use the current variant's ID, or fall back to the primary outfitImageId
    const imageId = variant?.id ?? image.outfitImageId ?? image.id;
    const imageUrl = this.displayImageUrl();

    if (!variant?.id && !image.outfitImageId) {
      console.warn('[ImageReviewComponent] No outfitImageId available, using outfit id. Edit may fail.');
    }

    const dialogRef = this.dialog.open(ImageEditDialogComponent, {
      width: '550px',
      maxWidth: '95vw',
      data: {
        outfitImageId: imageId,
        imageUrl: imageUrl
      } as ImageEditDialogData
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((result: ImageEditDialogResult | undefined) => {
      if (result?.saved && result.newImage) {
        this.snackBar.open('Image enhanced! Refreshing...', undefined, {
          duration: 2500
        });

        // Refresh images to include the new variant
        this.outfitService.refreshGeneratedImages().pipe(take(1)).subscribe({
          next: () => {
            // Reload current image to get updated variants
            const id = this.image()?.id;
            if (id) {
              const updatedImage = this.outfitService.getGeneratedImageById(id);
              if (updatedImage) {
                this.image.set(updatedImage);
                // Select the newest variant (last in array)
                if (updatedImage.variants?.length) {
                  this.selectedVariantIndex.set(updatedImage.variants.length - 1);
                }
              }
            }
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
