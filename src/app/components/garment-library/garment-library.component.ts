import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';

import { Garment, GarmentGroup } from '../../models/outfit';
import { OutfitService } from '../../services/outfit.service';
import { GarmentCategoryDto } from '../../models/outfitify-api';

type GarmentFilter = GarmentGroup | 'all';

@Component({
  selector: 'app-garment-library',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatExpansionModule
  ],
  templateUrl: './garment-library.component.html',
  styleUrls: ['./garment-library.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GarmentLibraryComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  // Active garment filter
  readonly groupFilter = signal<GarmentFilter>('all');
  readonly groupFilterOptions: ReadonlyArray<{ value: GarmentFilter; label: string }> = [
    { value: 'all', label: 'All garments' },
    { value: 'tops', label: 'Tops' },
    { value: 'bottoms', label: 'Bottoms' },
    { value: 'full-body', label: 'Full body' },
    { value: 'jackets', label: 'Jackets' },
    { value: 'accessories', label: 'Accessories' }
  ];

  // Catalogue from API
  readonly garments = toSignal(this.outfitService.garments$, { initialValue: [] });
  readonly isLoadingGarments = signal(false);
  readonly garmentsError = signal<string | null>(null);
  readonly garmentCategories = toSignal(this.outfitService.garmentCategories$, {
    initialValue: []
  });
  readonly imagePerspectives = toSignal(this.outfitService.imagePerspectives$, {
    initialValue: []
  });
  readonly garmentCategoryOptions = computed(() => {
    const categories = [...this.garmentCategories()];
    return categories.sort((a, b) => {
      const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const groupCompare =
        (a.group ?? '').toLowerCase().localeCompare((b.group ?? '').toLowerCase());
      if (groupCompare !== 0) {
        return groupCompare;
      }
      return (a.category ?? '').toLowerCase().localeCompare((b.category ?? '').toLowerCase());
    });
  });
  readonly isLoadingCategories = signal(false);
  readonly isLoadingImagePerspectives = signal(false);
  readonly garmentCategoriesError = signal<string | null>(null);
  readonly imagePerspectivesError = signal<string | null>(null);
  readonly selectedGarmentCategoryId = signal<number | null>(null);
  readonly selectedImagePerspectiveId = signal<number | null>(null);
  readonly isUploadingGarment = signal(false);

  // Selected garments from the service
  readonly selectedTop = toSignal(this.outfitService.selectedTop$, { initialValue: null });
  readonly selectedBottom = toSignal(this.outfitService.selectedBottom$, { initialValue: null });
  readonly selectedFullBody = toSignal(this.outfitService.selectedFullBody$, { initialValue: null });
  readonly selectedJacket = toSignal(this.outfitService.selectedJacket$, { initialValue: null });
  readonly selectedAccessories = toSignal(this.outfitService.selectedAccessories$, { initialValue: null });

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

  // Garments visible for the active group tab
  readonly garmentsForGroup = computed(() =>
    this.groupFilter() === 'all'
      ? this.garments()
      : this.garments().filter((garment) => garment.group === this.groupFilter())
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

    this.isLoadingCategories.set(true);
    this.outfitService
      .ensureGarmentCategoriesLoaded()
      .pipe(take(1))
      .subscribe({
        next: (categories) => {
          this.isLoadingCategories.set(false);
          this.garmentCategoriesError.set(null);
          const firstId = this.categoryId(categories[0]);
          if (firstId && !this.selectedGarmentCategoryId()) {
            this.selectedGarmentCategoryId.set(firstId);
          }
        },
        error: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to load garment categories. Please check your API configuration.';
          this.isLoadingCategories.set(false);
          this.garmentCategoriesError.set(message);
          this.snackBar.open(message, 'Dismiss', {
            duration: 3500
          });
        }
      });

    this.isLoadingImagePerspectives.set(true);
    this.outfitService
      .ensureImagePerspectivesLoaded()
      .pipe(take(1))
      .subscribe({
        next: (perspectives) => {
          this.isLoadingImagePerspectives.set(false);
          this.imagePerspectivesError.set(null);
          const firstId = this.perspectiveId(perspectives[0]);
          if (firstId !== null && this.selectedImagePerspectiveId() === null) {
            this.selectedImagePerspectiveId.set(firstId);
          }
        },
        error: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to load image perspectives. Please check your API configuration.';
          this.isLoadingImagePerspectives.set(false);
          this.imagePerspectivesError.set(message);
          this.snackBar.open(message, 'Dismiss', {
            duration: 3500
          });
        }
      });
  }

  handleGroupChange(value: GarmentFilter): void {
    this.groupFilter.set(value);
  }

  categoryId(category: GarmentCategoryDto | undefined): number | null {
    if (!category) return null;

    return (
      category.garmentCategoryEntityId ??
      (category as { garmentCategoryEntityID?: number }).garmentCategoryEntityID ??
      null
    );
  }

  perspectiveId(perspective: { id?: number; Id?: number } | undefined): number | null {
    if (!perspective) return null;
    return perspective.id ?? (perspective as { Id?: number }).Id ?? null;
  }

  perspectiveName(perspective: { name?: string | null; Name?: string | null } | undefined): string {
    if (!perspective) return 'Unknown';
    return perspective.name ?? (perspective as { Name?: string | null }).Name ?? 'Unknown';
  }

  categoryLabel(category: GarmentCategoryDto): string {
    const groupLabel = category.group || 'Category';
    const specific = category.category;

    if (specific && specific !== category.group) {
      return `${specific} • ${groupLabel}`;
    }

    return groupLabel;
  }

  handleGarmentUploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file to upload.', 'Dismiss', {
        duration: 4000
      });
      return;
    }

    const selectedCategoryId = this.selectedGarmentCategoryId();
    const selectedCategory = this.garmentCategories().find(
      (item) => this.categoryId(item) === selectedCategoryId
    );
    const selectedPerspectiveId = this.selectedImagePerspectiveId();
    const selectedPerspective = this.imagePerspectives().find(
      (item) => this.perspectiveId(item) === selectedPerspectiveId
    );
    if (selectedCategoryId === null || !selectedCategory) {
      this.snackBar.open('Choose a garment category before uploading an image.', 'Got it', {
        duration: 3500
      });
      return;
    }
    if (selectedPerspectiveId === null || !selectedPerspective) {
      this.snackBar.open('Choose an image perspective before uploading an image.', 'Got it', {
        duration: 3500
      });
      return;
    }

    this.isUploadingGarment.set(true);

    this.outfitService
      .uploadGarmentImage(file, selectedCategory, selectedPerspectiveId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isUploadingGarment.set(false);
          const targetGroup = this.toGarmentGroup(selectedCategory.group);
          this.groupFilter.set(targetGroup ?? 'all');
          this.snackBar.open(
            'Garment image uploaded. It’s now available in this category.',
            'Great!',
            { duration: 3000 }
          );
        },
        error: (err) => {
          this.isUploadingGarment.set(false);
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to upload your garment image right now.';
          this.snackBar.open(message, 'Dismiss', {
            duration: 4000
          });
        }
      });
  }

  // --- Card & size helpers ---

  isSelected(garment: Garment): boolean {
    const ids = this.selectedGarmentIds();
    return ids[garment.group] === garment.id;
  }

  sizeOptionsForGarment(garment: Garment): readonly string[] {
    if (garment.sizes && garment.sizes.length > 0) {
      return garment.sizes;
    }
    switch (garment.group) {
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

  private setDefaultSizeForGroup(group: GarmentGroup, garment: Garment | null): void {
    const firstSize = garment ? this.sizeOptionsForGarment(garment)[0] ?? null : null;
    this.outfitService.setSelectedSize(group, firstSize ?? null);
  }

  handleGarmentClick(garment: Garment): void {
    const group = garment.group;
    const alreadySelected = this.isSelected(garment);

    switch (group) {
      case 'full-body':
        // Full-body is mutually exclusive with separate top/bottom
        this.outfitService.setSelectedGarment('tops', null);
        this.outfitService.setSelectedSize('tops', null);
        this.outfitService.setSelectedGarment('bottoms', null);
        this.outfitService.setSelectedSize('bottoms', null);
        this.outfitService.setSelectedGarment('full-body', alreadySelected ? null : garment);
        this.setDefaultSizeForGroup('full-body', alreadySelected ? null : garment);
        break;

      case 'tops':
      case 'bottoms':
        // Selecting separates clears full-body
        this.outfitService.setSelectedGarment('full-body', null);
        this.outfitService.setSelectedSize('full-body', null);
        this.outfitService.setSelectedGarment(group, alreadySelected ? null : garment);
        this.setDefaultSizeForGroup(group, alreadySelected ? null : garment);
        break;

      case 'jackets':
      case 'accessories':
        // Optional layers, independent
        this.outfitService.setSelectedGarment(group, alreadySelected ? null : garment);
        this.setDefaultSizeForGroup(group, alreadySelected ? null : garment);
        break;
    }
  }

  handleGarmentKeydown(event: KeyboardEvent, garment: Garment): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleGarmentClick(garment);
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

  private groupForCategoryId(categoryId: number | null): GarmentGroup | null {
    if (!categoryId) {
      return null;
    }
    const category = this.garmentCategories().find(
      (item) => this.categoryId(item) === categoryId
    );
    return this.toGarmentGroup(category?.group);
  }

  private toGarmentGroup(value: string | null | undefined): GarmentGroup | null {
    const allowed: GarmentGroup[] = ['tops', 'bottoms', 'full-body', 'jackets', 'accessories'];
    return allowed.includes(value as GarmentGroup) ? (value as GarmentGroup) : null;
  }
}

const DEFAULT_TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
const DEFAULT_BOTTOM_SIZES = ['28', '30', '32', '34', '36'] as const;
const IMAGE_FALLBACK_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const PLACEHOLDER_IMAGE = 'assets/generated/placeholder-ready-1.svg';
