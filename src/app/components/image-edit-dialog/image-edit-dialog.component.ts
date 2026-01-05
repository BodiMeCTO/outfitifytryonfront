import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { take } from 'rxjs/operators';

import { OutfitifyApiService } from '../../services/outfitify-api.service';

export interface ImageEditDialogData {
  outfitImageId: string;
  imageUrl: string;
}

export interface ImageEditDialogResult {
  saved: boolean;
  newImage?: {
    id: string;
    assetUrl: string;
    resolution: string;
  };
}

export type FilterPreset = 'none' | 'auto' | 'vivid' | 'warm' | 'cool' | 'bw' | 'vintage' | 'bright' | 'sharp';

export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpness: number;
}

// Memory-safe limits for upscaling (must match backend RealEsrganUpscaleService)
const UPSCALE_LIMITS = {
  '2x': { maxWidth: 1500, maxHeight: 1500 },
  '4x': { maxWidth: 800, maxHeight: 800 }
} as const;

@Component({
  selector: 'app-image-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTabsModule,
    MatCheckboxModule
  ],
  templateUrl: './image-edit-dialog.component.html',
  styleUrls: ['./image-edit-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageEditDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ImageEditDialogComponent>);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data: ImageEditDialogData = inject(MAT_DIALOG_DATA);

  // Image dimensions (loaded on init)
  readonly imageDimensions = signal<{ width: number; height: number } | null>(null);
  readonly dimensionsLoading = signal(true);

  // Filter presets
  readonly presets: { value: FilterPreset; label: string; icon: string }[] = [
    { value: 'none', label: 'None', icon: 'block' },
    { value: 'auto', label: 'Auto', icon: 'auto_fix_high' },
    { value: 'vivid', label: 'Vivid', icon: 'palette' },
    { value: 'warm', label: 'Warm', icon: 'wb_sunny' },
    { value: 'cool', label: 'Cool', icon: 'ac_unit' },
    { value: 'bw', label: 'B&W', icon: 'filter_b_and_w' },
    { value: 'vintage', label: 'Vintage', icon: 'filter_vintage' },
    { value: 'bright', label: 'Bright', icon: 'brightness_high' },
    { value: 'sharp', label: 'Sharp', icon: 'deblur' }
  ];

  // State
  readonly selectedPreset = signal<FilterPreset>('none');
  readonly customFilters = signal<FilterSettings>({
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    warmth: 0,
    sharpness: 0
  });
  readonly enableUpscale = signal(false);
  readonly upscaleScale = signal<'2x' | '4x'>('2x');
  readonly upscaleDenoise = signal(1);
  readonly isProcessing = signal(false);
  readonly activeTab = signal(0);

  // Computed CSS filter for preview
  readonly previewFilter = computed(() => {
    const preset = this.selectedPreset();
    const custom = this.customFilters();

    // If a preset is selected, apply preset-specific CSS filters
    switch (preset) {
      case 'vivid':
        return 'saturate(1.3) contrast(1.1)';
      case 'warm':
        return 'sepia(0.2) saturate(1.2)';
      case 'cool':
        return 'hue-rotate(-20deg) saturate(1.1)';
      case 'bw':
        return 'grayscale(1)';
      case 'vintage':
        return 'sepia(0.4) contrast(0.9)';
      case 'bright':
        return 'brightness(1.2) contrast(1.05)';
      case 'sharp':
        return 'contrast(1.1)';
      case 'auto':
        return 'contrast(1.05)';
      default:
        // Use custom values
        return `brightness(${custom.brightness}) contrast(${custom.contrast}) saturate(${custom.saturation}) hue-rotate(${custom.warmth}deg)`;
    }
  });

  // Credit cost
  readonly creditCost = computed(() => {
    return this.enableUpscale() ? 1 : 0;
  });

  // Check if 2x upscale is allowed based on image dimensions
  readonly can2xUpscale = computed(() => {
    const dims = this.imageDimensions();
    if (!dims) return true; // Allow while loading
    const limit = UPSCALE_LIMITS['2x'];
    return dims.width <= limit.maxWidth && dims.height <= limit.maxHeight;
  });

  // Check if 4x upscale is allowed based on image dimensions
  readonly can4xUpscale = computed(() => {
    const dims = this.imageDimensions();
    if (!dims) return true; // Allow while loading
    const limit = UPSCALE_LIMITS['4x'];
    return dims.width <= limit.maxWidth && dims.height <= limit.maxHeight;
  });

  // Check if current upscale selection is valid
  readonly upscaleValid = computed(() => {
    if (!this.enableUpscale()) return true;
    const scale = this.upscaleScale();
    return scale === '2x' ? this.can2xUpscale() : this.can4xUpscale();
  });

  // Get warning message for upscale size limits
  readonly upscaleSizeWarning = computed(() => {
    const dims = this.imageDimensions();
    if (!dims) return null;

    if (!this.can2xUpscale()) {
      const limit = UPSCALE_LIMITS['2x'];
      return `Image (${dims.width}×${dims.height}) exceeds the ${limit.maxWidth}×${limit.maxHeight} limit for upscaling. Consider using a smaller source image.`;
    }

    if (this.enableUpscale() && this.upscaleScale() === '4x' && !this.can4xUpscale()) {
      const limit = UPSCALE_LIMITS['4x'];
      return `Image (${dims.width}×${dims.height}) exceeds the ${limit.maxWidth}×${limit.maxHeight} limit for 4× upscaling. Use 2× instead.`;
    }

    return null;
  });

  // Can apply
  readonly canApply = computed(() => {
    if (this.isProcessing()) return false;

    // Check upscale size limits
    if (!this.upscaleValid()) return false;

    // Check if any changes are made
    const hasPreset = this.selectedPreset() !== 'none';
    const hasCustomFilters = this.hasCustomFilterChanges();
    const hasUpscale = this.enableUpscale();

    return hasPreset || hasCustomFilters || hasUpscale;
  });

  ngOnInit(): void {
    this.loadImageDimensions();
  }

  private loadImageDimensions(): void {
    if (!this.data.imageUrl) {
      this.dimensionsLoading.set(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      this.imageDimensions.set({ width: img.naturalWidth, height: img.naturalHeight });
      this.dimensionsLoading.set(false);

      // Auto-disable upscale if image is too large for any upscaling
      if (!this.can2xUpscale()) {
        this.enableUpscale.set(false);
      }
    };
    img.onerror = () => {
      console.warn('Failed to load image dimensions');
      this.dimensionsLoading.set(false);
    };
    img.src = this.data.imageUrl;
  }

  private hasCustomFilterChanges(): boolean {
    const f = this.customFilters();
    return (
      Math.abs(f.brightness - 1.0) > 0.01 ||
      Math.abs(f.contrast - 1.0) > 0.01 ||
      Math.abs(f.saturation - 1.0) > 0.01 ||
      Math.abs(f.warmth) > 0.5 ||
      f.sharpness > 0.01
    );
  }

  selectPreset(preset: FilterPreset): void {
    this.selectedPreset.set(preset);
    // Reset custom filters when preset selected
    if (preset !== 'none') {
      this.resetCustomFilters();
    }
  }

  resetCustomFilters(): void {
    this.customFilters.set({
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      warmth: 0,
      sharpness: 0
    });
  }

  updateCustomFilter(key: keyof FilterSettings, value: number): void {
    // When custom filters change, clear preset
    this.selectedPreset.set('none');
    this.customFilters.update(f => ({ ...f, [key]: value }));
  }

  toggleUpscale(): void {
    this.enableUpscale.update(v => !v);
  }

  setUpscaleScale(scale: '2x' | '4x'): void {
    this.upscaleScale.set(scale);
  }

  applyEdit(): void {
    if (!this.canApply()) return;

    this.isProcessing.set(true);

    const payload: any = {};

    // Add preset or custom filters
    if (this.selectedPreset() !== 'none') {
      payload.filterPreset = this.selectedPreset();
    } else if (this.hasCustomFilterChanges()) {
      payload.customFilters = this.customFilters();
    }

    // Add upscale if enabled
    if (this.enableUpscale()) {
      payload.upscale = {
        scale: this.upscaleScale(),
        denoise: this.upscaleDenoise()
      };
    }

    this.apiService.editOutfitImage(this.data.outfitImageId, payload).pipe(take(1)).subscribe({
      next: (result) => {
        this.isProcessing.set(false);
        this.snackBar.open('Image enhanced successfully!', 'Great!', { duration: 3000 });
        this.dialogRef.close({
          saved: true,
          newImage: {
            id: result.newOutfitImageId,
            assetUrl: result.assetUrl,
            resolution: result.resolution
          }
        } as ImageEditDialogResult);
      },
      error: (err) => {
        this.isProcessing.set(false);
        const msg = err?.error?.error || err?.message || 'Failed to enhance image. Please try again.';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      }
    });
  }

  cancel(): void {
    this.dialogRef.close({ saved: false } as ImageEditDialogResult);
  }
}
