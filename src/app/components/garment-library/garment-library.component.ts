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

  // Filter
  readonly groupFilter = signal<GarmentFilter>('all');
  readonly groupFilterOptions = [
    { value: 'all' as const, label: 'All garments' },
    { value: 'tops' as const, label: 'Tops' },
    { value: 'bottoms' as const, label: 'Bottoms' },
    { value: 'full-body' as const, label: 'Full body' },
    { value: 'jackets' as const, label: 'Jackets' },
    { value: 'accessories' as const, label: 'Accessories' }
  ];

  // Data
  readonly garments = toSignal(this.outfitService.garments$, { initialValue: [] as Garment[] });
  readonly garmentCategories = toSignal(this.outfitService.garmentCategories$, { initialValue: [] as GarmentCategoryDto[] });
  readonly imagePerspectives = toSignal(this.outfitService.imagePerspectives$, { initialValue: [] });

  readonly filteredGarments = computed(() => {
    const filter = this.groupFilter();
    const all = this.garments();
    return filter === 'all' ? all : all.filter(g => g.group === filter);
  });

  // Selected garments as signals (for reactivity)
  readonly selectedTop = toSignal(this.outfitService.selectedTop$, { initialValue: null });
  readonly selectedBottom = toSignal(this.outfitService.selectedBottom$, { initialValue: null });
  readonly selectedFullBody = toSignal(this.outfitService.selectedFullBody$, { initialValue: null });
  readonly selectedJacket = toSignal(this.outfitService.selectedJacket$, { initialValue: null });
  readonly selectedAccessories = toSignal(this.outfitService.selectedAccessories$, { initialValue: null });

  // Computed map of selected garment IDs by group
  readonly selectedIdByGroup = computed(() => {
    return {
      tops: this.selectedTop()?.id ?? null,
      bottoms: this.selectedBottom()?.id ?? null,
      'full-body': this.selectedFullBody()?.id ?? null,
      jackets: this.selectedJacket()?.id ?? null,
      accessories: this.selectedAccessories()?.id ?? null
    } as Record<GarmentGroup, string | number | null>;
  });

  // Loading & errors
  readonly isLoadingGarments = signal(false);
  readonly garmentsError = signal<string | null>(null);
  readonly isLoadingCategories = signal(false);
  readonly garmentCategoriesError = signal<string | null>(null);
  readonly isLoadingImagePerspectives = signal(false);
  readonly imagePerspectivesError = signal<string | null>(null);

  // Upload
  readonly selectedGarmentCategoryId = signal<number | null>(null);
  readonly selectedImagePerspectiveId = signal<number | null>(null);
  readonly isUploadingGarment = signal(false);

  // Submission
  readonly isSubmitting = signal(false);
  private readonly attemptedImageFallbacks = signal<Record<string, number>>({});

  readonly garmentCategoryOptions = computed(() => {
    const cats = [...this.garmentCategories()];
    return cats.sort((a, b) => {
      const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const groupA = (a.group ?? '').toLowerCase();
      const groupB = (b.group ?? '').toLowerCase();
      if (groupA !== groupB) return groupA.localeCompare(groupB);
      return (a.category ?? '').toLowerCase().localeCompare(b.category ?? '');
    });
  });

  ngOnInit(): void {
    this.loadGarments();
    this.loadGarmentCategories();
    this.loadImagePerspectives();
  }

  private loadGarments(): void {
    this.isLoadingGarments.set(true);
    this.outfitService.ensureGarmentsLoaded().pipe(take(1)).subscribe({
      next: () => {
        this.isLoadingGarments.set(false);
        this.garmentsError.set(null);
      },
      error: (err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load garments.';
        this.isLoadingGarments.set(false);
        this.garmentsError.set(msg);
        this.snackBar.open(msg, 'Dismiss', { duration: 3500 });
      }
    });
  }

  private loadGarmentCategories(): void {
    this.isLoadingCategories.set(true);
    this.outfitService.ensureGarmentCategoriesLoaded().pipe(take(1)).subscribe({
      next: (cats) => {
        this.isLoadingCategories.set(false);
        this.garmentCategoriesError.set(null);
        const firstId = this.categoryId(cats[0]);
        if (firstId && this.selectedGarmentCategoryId() === null) {
          this.selectedGarmentCategoryId.set(firstId);
        }
      },
      error: (err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load categories.';
        this.isLoadingCategories.set(false);
        this.garmentCategoriesError.set(msg);
        this.snackBar.open(msg, 'Dismiss', { duration: 3500 });
      }
    });
  }

  private loadImagePerspectives(): void {
    this.isLoadingImagePerspectives.set(true);
    this.outfitService.ensureImagePerspectivesLoaded().pipe(take(1)).subscribe({
      next: (pers) => {
        this.isLoadingImagePerspectives.set(false);
        this.imagePerspectivesError.set(null);
        const firstId = this.perspectiveId(pers[0]);
        if (firstId !== null && this.selectedImagePerspectiveId() === null) {
          this.selectedImagePerspectiveId.set(firstId);
        }
      },
      error: (err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load perspectives.';
        this.isLoadingImagePerspectives.set(false);
        this.imagePerspectivesError.set(msg);
        this.snackBar.open(msg, 'Dismiss', { duration: 3500 });
      }
    });
  }

  isSelected(garment: Garment): boolean {
    const selectedId = this.selectedIdByGroup()[garment.group];
    return selectedId === garment.id;
  }

  trackGarmentById(index: number, garment: Garment): string | number {
    return garment.id;
  }

  toggleGarment(garment: Garment): void {
    const group = garment.group;
    const selectedId = this.selectedIdByGroup()[group];
    const isCurrentlySelected = selectedId === garment.id;

    if (isCurrentlySelected) {
      // Deselect
      this.outfitService.setSelectedGarment(group, null);
      this.outfitService.setSelectedSize(group, null);
    } else {
      // Select
      this.outfitService.setSelectedGarment(group, garment);
      
      // Set default size
      const sizes = garment.sizes ?? [];
      const defaultSize = sizes.length > 0
        ? sizes[0]
        : group === 'bottoms'
          ? '32'
          : 'M';
      this.outfitService.setSelectedSize(group, defaultSize);

      // Mutual exclusion
      if (group === 'full-body') {
        this.outfitService.setSelectedGarment('tops', null);
        this.outfitService.setSelectedGarment('bottoms', null);
        this.outfitService.setSelectedSize('tops', null);
        this.outfitService.setSelectedSize('bottoms', null);
      } else if (group === 'tops' || group === 'bottoms') {
        this.outfitService.setSelectedGarment('full-body', null);
        this.outfitService.setSelectedSize('full-body', null);
      }
    }
  }

  categoryId(category: GarmentCategoryDto | undefined): number | null {
    if (!category) return null;
    return category.garmentCategoryEntityId ?? (category as any).garmentCategoryEntityID ?? null;
  }

  perspectiveId(perspective: any): number | null {
    if (!perspective) return null;
    return perspective.id ?? perspective.Id ?? null;
  }

  perspectiveName(perspective: any): string {
    if (!perspective) return 'Unknown';
    return perspective.name ?? perspective.Name ?? 'Unknown';
  }

  categoryLabel(category: GarmentCategoryDto): string {
    const group = category.group || 'Category';
    const specific = category.category;
    return specific && specific !== group ? `${specific} • ${group}` : group;
  }

  handleGarmentUploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file.', 'Dismiss', { duration: 4000 });
      return;
    }

    const catId = this.selectedGarmentCategoryId();
    const category = this.garmentCategories().find(c => this.categoryId(c) === catId);
    const persId = this.selectedImagePerspectiveId();

    if (!category || persId === null) {
      this.snackBar.open('Select category and perspective first.', 'Got it', { duration: 3500 });
      return;
    }

    this.isUploadingGarment.set(true);
    this.outfitService.uploadGarmentImage(file, category, persId).pipe(take(1)).subscribe({
      next: () => {
        this.isUploadingGarment.set(false);
        const targetGroup = this.toGarmentGroup(category.group);
        this.groupFilter.set(targetGroup ?? 'all');
        this.snackBar.open('Garment uploaded!', 'Great!', { duration: 3000 });
      },
      error: (err) => {
        this.isUploadingGarment.set(false);
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      }
    });
  }

  handleImageError(event: Event, garment: Garment): void {
    const img = event.target as HTMLImageElement;
    if (img.dataset['failed'] === 'true') return;

    const attempts = this.attemptedImageFallbacks();
    const attempt = attempts[garment.id] ?? 0;
    const base = garment.image.replace(/\.[^/.]+$/, '');

    if (attempt >= IMAGE_FALLBACK_EXTENSIONS.length) {
      img.dataset['failed'] = 'true';
      img.src = '/assets/images/placeholder-garment.png';
      return;
    }

    this.attemptedImageFallbacks.update(a => ({ ...a, [garment.id]: attempt + 1 }));
    img.src = `${base}.${IMAGE_FALLBACK_EXTENSIONS[attempt]}`;
  }

  submitOutfit(): void {
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.outfitService.createOutfit().pipe(take(1)).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.snackBar.open('Outfit creation started!', 'Nice!', { duration: 3500 });
        this.router.navigate(['/generated-gallery']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err instanceof Error ? err.message : 'Failed to create outfit.';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      }
    });
  }

  private toGarmentGroup(value: string | null | undefined): GarmentGroup | null {
    const allowed: GarmentGroup[] = ['tops', 'bottoms', 'full-body', 'jackets', 'accessories'];
    return allowed.includes(value as GarmentGroup) ? (value as GarmentGroup) : null;
  }
}

const IMAGE_FALLBACK_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;