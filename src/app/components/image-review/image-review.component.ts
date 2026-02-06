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
import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { CreditsService } from '../../services/credits.service';
import { VideoService, VideoDto } from '../../services/video.service';
import { DownloadService } from '../../services/download.service';
import { GeneratedImage, OutfitImageVariant } from '../../models/outfit';
import { ImageEditDialogComponent, ImageEditDialogData, ImageEditDialogResult } from '../image-edit-dialog/image-edit-dialog.component';
import { VideoDialogComponent, VideoDialogData, VideoDialogResult } from '../video-dialog/video-dialog.component';
import { AddGarmentsDialogComponent, AddGarmentsDialogData, AddGarmentsDialogResult } from '../add-garments-dialog/add-garments-dialog.component';
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
  readonly isZoomed = signal<boolean>(false); // Zoom toggle (#22)
  readonly videos = signal<VideoDto[]>([]);
  readonly isLoadingVideos = signal<boolean>(false);
  private readonly subscriptions = new Subscription();
  private readonly dialog = inject(MatDialog);
  private readonly videoService = inject(VideoService);
  private readonly downloadService = inject(DownloadService);

  // Toggle zoom on image (#22)
  toggleZoom(): void {
    this.isZoomed.set(!this.isZoomed());
  }

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

  private readonly creditsService = inject(CreditsService);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly outfitService: OutfitService,
    private readonly apiService: OutfitifyApiService,
    private readonly snackBar: MatSnackBar
  ) {}

  // Navigate to gallery
  goToGallery(): void {
    this.router.navigate(['/generated-gallery']);
  }

  // Archive the current outfit and return to gallery
  archive(): void {
    const current = this.image();
    if (!current) return;

    this.apiService.archiveOutfit(current.id).pipe(take(1)).subscribe({
      next: () => {
        this.outfitService.removeGeneratedImage(current.id);
        this.snackBar.open('Outfit archived.', 'Dismiss', { duration: 2500 });
        this.router.navigate(['/generated-gallery']);
      },
      error: () => {
        this.snackBar.open('Failed to archive outfit.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  // Redo the current outfit (create a new one with same settings)
  redo(): void {
    const current = this.image();
    if (!current) return;

    // Only allow redo on ready outfits
    if (current.status !== 'ready') {
      this.snackBar.open('Can only redo completed outfits.', 'Dismiss', { duration: 3000 });
      return;
    }

    this.apiService.redoOutfit(current.id).pipe(take(1)).subscribe({
      next: (newOutfit) => {
        this.snackBar.open('New outfit queued! Check the gallery for progress.', 'View', { duration: 4000 })
          .onAction().pipe(take(1)).subscribe(() => {
            this.router.navigate(['/generated-gallery']);
          });
        // Refresh the gallery to show the new outfit
        this.outfitService.refreshGeneratedImages().pipe(take(1)).subscribe();
        // Refresh credits as redo costs credits
        this.creditsService.refresh().pipe(take(1)).subscribe();
      },
      error: (err) => {
        const message = err?.error?.error || 'Failed to redo outfit. Please try again.';
        this.snackBar.open(message, 'Dismiss', { duration: 4000 });
      }
    });
  }

  // Open the Add Garments dialog
  openAddGarmentsDialog(): void {
    const current = this.image();
    if (!current) return;

    // Only allow on ready outfits
    if (current.status !== 'ready') {
      this.snackBar.open('Can only add items to completed outfits.', 'Dismiss', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(AddGarmentsDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        outfitId: current.id,
        existingGarments: current.garments ?? []
      } as AddGarmentsDialogData
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((result: AddGarmentsDialogResult | undefined) => {
      if (result?.created) {
        this.snackBar.open('New outfit queued! Check the gallery for progress.', 'View', { duration: 4000 })
          .onAction().pipe(take(1)).subscribe(() => {
            this.router.navigate(['/generated-gallery']);
          });
        // Refresh the gallery to show the new outfit
        this.outfitService.refreshGeneratedImages().pipe(take(1)).subscribe();
        // Refresh credits as add-garments costs credits
        this.creditsService.refresh().pipe(take(1)).subscribe();
      }
    });
  }

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        return;
      }
      const image = this.outfitService.getGeneratedImageById(id);
      if (image) {
        this.image.set(image);
        this.loadVideos(id);
        return;
      }

      const refreshSub = this.outfitService
        .refreshGeneratedImages()
        .pipe(take(1))
        .subscribe({
          next: (images) => {
            const match = images.find((item) => item.id === id);
            this.image.set(match);
            if (match) {
              this.loadVideos(id);
            } else {
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

    await this.downloadService.downloadImage(imageUrl, filename);
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

    const variantSuffix = variant?.editType ? `-${variant.editType}` : '';
    const filename = `outfitify-outfit-${image.id}${variantSuffix}-watermarked.png`;

    await this.downloadService.downloadImageWithWatermark(imageUrl, filename);
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

  openVideoDialog(): void {
    const image = this.image();
    const variant = this.currentVariant();

    if (!image) {
      return;
    }

    // Get the current credits balance
    const userCredits = this.creditsService.balance ?? 0;

    // Use the current variant's ID, or fall back to the primary outfitImageId
    const imageId = variant?.id ?? image.outfitImageId ?? image.id;
    const imageUrl = this.displayImageUrl();

    const dialogRef = this.dialog.open(VideoDialogComponent, {
      width: '550px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        outfitId: image.id,
        outfitImageId: imageId,
        imageUrl: imageUrl,
        userCredits: userCredits
      } as VideoDialogData
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((result: VideoDialogResult | undefined) => {
      if (result?.created && result.video) {
        this.snackBar.open('Video created successfully!', 'OK', { duration: 3000 });
        // Refresh credits balance and videos list
        this.creditsService.refresh().pipe(take(1)).subscribe();
        this.loadVideos(image.id);
      }
    });
  }

  /**
   * Load videos for the current outfit
   */
  private loadVideos(outfitId: string): void {
    this.isLoadingVideos.set(true);
    this.videoService.getVideos(outfitId).pipe(take(1)).subscribe({
      next: (videos) => {
        // Only show ready videos, sorted by newest first
        const readyVideos = videos
          .filter(v => v.status === 'ready')
          .sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
        this.videos.set(readyVideos);
        this.isLoadingVideos.set(false);
      },
      error: (err) => {
        console.error('Failed to load videos:', err);
        this.videos.set([]);
        this.isLoadingVideos.set(false);
      }
    });
  }

  /**
   * Get the full video URL for playback
   */
  getVideoUrl(video: VideoDto): string {
    return this.videoService.getFullVideoUrl(video.videoUrl!);
  }

  /**
   * Download a video
   */
  async downloadVideo(video: VideoDto): Promise<void> {
    const fullUrl = this.videoService.getFullVideoUrl(video.videoUrl!);
    const filename = `outfitify-video-${video.id}.mp4`;
    await this.downloadService.downloadVideo(fullUrl, filename);
  }

  /**
   * Format video duration for display
   */
  formatDuration(seconds: number): string {
    return `${seconds}s`;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
