import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';

import { Garment, GarmentCategory } from '../../models/outfit';
import { OutfitService } from '../../services/outfit.service';

@Component({
  selector: 'app-garment-library',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './garment-library.component.html',
  styleUrls: ['./garment-library.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GarmentLibraryComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  // Active category tab
  readonly category = signal<GarmentCategory>('tops');

  // Catalogue from API
  readonly garments = toSignal(this.outfitService.garments$, { initialValue: [] });
  readonly isLoadingGarments = signal(false);
  readonly garmentsError = signal<string | null>(null);

  // Selected garments from the service
  readonly selectedTop = toSignal(this.outfitService.selectedTop$, { initialValue: null });
  readonly selectedBottom = toSignal(this.outfitService.selectedBottom$, { initialValue: null });
  readonly selectedFullBody = toSignal(this.outfitService.selectedFullBody$, { initialValue: null });
  readonly selectedJacket = toSignal(this.outfitService.selectedJacket$, { initialValue: null });
  readonly selectedAccessories = toSignal(this.outfitService.selectedAccessories$, { initialValue: null });

  // Selected sizes
  readonly selectedTopSize = toSignal(this.outfitService.selectedTopSize$, { initialValue: null });
  readonly selectedBottomSize = toSignal(this.outfitService.selectedBottomSize$, { initialValue: null });
  readonly selectedFullBodySize = toSignal(this.outfitService.selectedFullBodySize$, { initialValue: null });
  readonly selectedJacketSize = toSignal(this.outfitService.selectedJacketSize$, { initialValue: null });
  readonly selectedAccessoriesSize = toSignal(this.outfitService.selectedAccessoriesSize$, { initialValue: null });

  // Validity flags from service
  readonly hasCompleteGarmentSelection = toSignal(this.outfitService.hasCompleteGarmentSelection$, {
    initialValue: false
  });
  readonly hasCompleteOutfitSelection = toSignal(this.outfitService.hasCompleteSelection$, {
    initialValue: false
  });

  // For card highlighting
  readonly selectedGarmentIds = computed(() => ({
    tops: this.selectedTop()?.id ?? null,
    bottoms: this.selectedBottom()?.id ?? null,
    'full-body': this.selectedFullBody()?.id ?? null,
    jackets: this.selectedJacket()?.id ?? null,
    accessories: this.selectedAccessories()?.id ?? null
  }));

  readonly isSubmitting = signal(false);
  private readonly attemptedImageFallbacks = signal<Record<string, number>>({});

  // Garments visible for the active category tab
  readonly garmentsForCategory = computed(() =>
    this.garments().filter((garment) => garment.category === this.category())
  );

  ngOnInit(): void {
    this.isLoadingGarments.set(true);
    this.outfitService
      .ensureGarmentsLoaded()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isLoadingGarments.set(false);
          this.garmentsError.set(null);
        },
        error: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to load garments. Please check your API configuration.';
          this.isLoadingGarments.set(false);
          this.garmentsError.set(message);
          this.snackBar.open(message, 'Dismiss', {
            duration: 3500
          });
        }
      });
  }

  handleCategoryChange(event: { value: GarmentCategory }): void {
    this.category.set(event.value);
  }

  // --- Card & size helpers ---

  isSelected(garment: Garment): boolean {
    const ids = this.selectedGarmentIds();
    return ids[garment.category] === garment.id;
  }

  sizeOptionsForGarment(garment: Garment): readonly string[] {
    if (garment.sizes && garment.sizes.length > 0) {
      return garment.sizes;
    }
    switch (garment.category) {
      case 'tops':
      case 'full-body':
      case 'jackets':
      case 'accessories':
        return DEFAULT_TOP_SIZES;
      case 'bottoms':
        return DEFAULT_BOTTOM_SIZES;
      default:
        return [];
    }
  }

  selectedSizeForCategory(category: GarmentCategory): string | null {
    switch (category) {
      case 'tops':
        return this.selectedTopSize();
      case 'bottoms':
        return this.selectedBottomSize();
      case 'full-body':
        return this.selectedFullBodySize();
      case 'jackets':
        return this.selectedJacketSize();
      case 'accessories':
        return this.selectedAccessoriesSize();
      default:
        return null;
    }
  }

  /**
   * ONE-CLICK selection: picking a size on a card selects
   * both the garment and that size for its category.
   */
  handleSizeClick(garment: Garment, size: string): void {
    const category = garment.category;

    switch (category) {
      case 'full-body':
        // Full-body is mutually exclusive with separate top/bottom
        this.outfitService.setSelectedGarment('tops', null);
        this.outfitService.setSelectedSize('tops', null);
        this.outfitService.setSelectedGarment('bottoms', null);
        this.outfitService.setSelectedSize('bottoms', null);
        this.outfitService.setSelectedGarment('full-body', garment);
        this.outfitService.setSelectedSize('full-body', size);
        break;

      case 'tops':
      case 'bottoms':
        // Selecting separates clears full-body
        this.outfitService.setSelectedGarment('full-body', null);
        this.outfitService.setSelectedSize('full-body', null);
        this.outfitService.setSelectedGarment(category, garment);
        this.outfitService.setSelectedSize(category, size);
        break;

      case 'jackets':
      case 'accessories':
        // Optional layers, independent
        this.outfitService.setSelectedGarment(category, garment);
        this.outfitService.setSelectedSize(category, size);
        break;
    }
  }

  submitOutfit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const hasFullBody = !!this.selectedFullBody();
    const hasTop = !!this.selectedTop();
    const hasBottom = !!this.selectedBottom();
    const invalidMix = hasFullBody && (hasTop || hasBottom);

    if (!this.hasCompleteGarmentSelection()) {
      if (invalidMix) {
        this.snackBar.open(
          'You can’t combine a full-body garment with a separate top or bottom. Choose one approach.',
          'Got it',
          { duration: 4000 }
        );
      } else {
        this.snackBar.open(
          'Select either a full-body garment, or a top and a bottom, before continuing.',
          'Got it',
          { duration: 4000 }
        );
      }
      return;
    }

    if (!this.hasCompleteOutfitSelection()) {
      if (hasFullBody) {
        this.snackBar.open('Pick a size for your full-body garment.', 'OK', {
          duration: 3000
        });
      } else {
        this.snackBar.open('Pick a size for your top and bottom.', 'OK', {
          duration: 3000
        });
      }
      return;
    }

    this.isSubmitting.set(true);
    this.outfitService
      .createOutfit()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.snackBar.open(
            'Outfit creation started. Check the gallery for updates.',
            'Nice!',
            { duration: 3500 }
          );
          this.router.navigate(['/generated-gallery']);
        },
        error: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to create your outfit right now. Please check your API configuration.';
          this.isSubmitting.set(false);
          this.snackBar.open(message, 'Dismiss', {
            duration: 4000
          });
        }
      });
  }

  handleImageError(event: Event, garment: Garment): void {
    const img = event.target as HTMLImageElement;
    const currentFallbacks = { ...this.attemptedImageFallbacks() };
    const attemptIndex = currentFallbacks[garment.id] ?? 0;
    const basePath = garment.image.replace(/\.[^/.]+$/, '');
    if (attemptIndex >= IMAGE_FALLBACK_EXTENSIONS.length) {
      img.src = PLACEHOLDER_IMAGE;
      return;
    }

    const nextSrc = `${basePath}.${IMAGE_FALLBACK_EXTENSIONS[attemptIndex]}`;
    currentFallbacks[garment.id] = attemptIndex + 1;
    this.attemptedImageFallbacks.set(currentFallbacks);
    img.src = nextSrc;
  }
}

const DEFAULT_TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
const DEFAULT_BOTTOM_SIZES = ['28', '30', '32', '34', '36'] as const;
const IMAGE_FALLBACK_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const PLACEHOLDER_IMAGE = 'assets/generated/placeholder-ready-1.svg';
