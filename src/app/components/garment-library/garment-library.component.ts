import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';

import { Garment, GarmentGroup } from '../../models/outfit';
import { OutfitService } from '../../services/outfit.service';
import { GarmentCategoryDto } from '../../models/outfitify-api';
import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { SmartGarmentUploadDialogComponent } from '../smart-garment-upload-dialog/smart-garment-upload-dialog.component';
import { ArchivePanelComponent } from '../archive-panel/archive-panel.component';

type GarmentFilter = GarmentGroup | 'all';

@Component({
  selector: 'app-garment-library',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDialogModule,
    ArchivePanelComponent
  ],
  templateUrl: './garment-library.component.html',
  styleUrls: ['./garment-library.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GarmentLibraryComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  // Filter
  readonly groupFilter = signal<GarmentFilter>('all');
  readonly groupFilterOptions = [
    { value: 'all' as const, label: 'All garments' },
    { value: 'tops' as const, label: 'Tops' },
    { value: 'bottoms' as const, label: 'Bottoms' },
    { value: 'full-body' as const, label: 'Full body' },
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
  readonly selectedTop = toSignal(this.outfitService.selectedTop$, { initialValue: [] });
  readonly selectedBottom = toSignal(this.outfitService.selectedBottom$, { initialValue: [] });
  readonly selectedFullBody = toSignal(this.outfitService.selectedFullBody$, { initialValue: [] });
  readonly selectedJacket = toSignal(this.outfitService.selectedJacket$, { initialValue: [] });
  readonly selectedAccessories = toSignal(this.outfitService.selectedAccessories$, { initialValue: [] });

  // Computed map of selected garment IDs by group
  readonly selectedIdsByGroup = computed(() => {
    return {
      tops: this.selectedTop().map(g => g.id),
      bottoms: this.selectedBottom().map(g => g.id),
      'full-body': this.selectedFullBody().map(g => g.id),
      jackets: this.selectedJacket().map(g => g.id),
      accessories: this.selectedAccessories().map(g => g.id)
    } as Record<GarmentGroup, string[]>;
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

  // Credits cost estimation
  readonly estimatedCost = toSignal(this.outfitService.estimatedCreditsCost$, { initialValue: 2 });

  // Archive panel
  readonly isArchivePanelOpen = signal(false);
  readonly isArchivingGarment = signal(false);

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
        // Debug logging: inspect incoming garment objects for category ID fields
        try {
          const items = this.garments() ?? [];
          console.log('[GarmentLibrary] garments loaded:', { count: items.length, sample: items.slice(0, 10) });
          const hasCategoryField = items.some(it => (it as any).garmentCategoryEntityId !== undefined || (it as any).garmentCategoryEntityID !== undefined);
          console.log('[GarmentLibrary] garmentCategoryEntityId present on any garment?:', hasCategoryField);
          const categoryIds = items.map(it => (it as any).garmentCategoryEntityId ?? (it as any).garmentCategoryEntityID ?? null).slice(0, 20);
          console.log('[GarmentLibrary] garmentCategoryEntityId values (first 20):', categoryIds);
        } catch (e) {
          console.error('[GarmentLibrary] error while logging garments', e);
        }
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
    const selectedIds = this.selectedIdsByGroup()[garment.group];
    return selectedIds.includes(garment.id);
  }

  trackGarmentById(index: number, garment: Garment): string | number {
    return garment.id;
  }

  toggleGarment(garment: Garment): void {
    this.outfitService.toggleSelectedGarment(garment.group, garment);
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

  // --- Smart Garment Upload Dialog ---

  openUploadDialog(): void {
    const dialogRef = this.dialog.open(SmartGarmentUploadDialogComponent, {
      width: '450px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'garment-upload-dialog',
      disableClose: false
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe(result => {
      if (result?.saved) {
        // Force reload garments to show newly added ones (bypass cache)
        this.isLoadingGarments.set(true);
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe({
          next: () => {
            this.isLoadingGarments.set(false);
            this.garmentsError.set(null);
          },
          error: (err) => {
            const msg = err instanceof Error ? err.message : 'Failed to reload garments.';
            this.isLoadingGarments.set(false);
            this.garmentsError.set(msg);
          }
        });
      }
    });
  }
}

  // --- Archive Methods ---

  openArchivePanel(): void {
    this.isArchivePanelOpen.set(true);
  }

  closeArchivePanel(): void {
    this.isArchivePanelOpen.set(false);
  }

  archiveGarment(event: Event, garment: Garment): void {
    event.stopPropagation();
    if (this.isArchivingGarment()) return;

    this.isArchivingGarment.set(true);
    this.apiService.archiveGarment(garment.id).pipe(take(1)).subscribe({
      next: () => {
        this.isArchivingGarment.set(false);
        this.snackBar.open('Garment archived', 'Undo', { duration: 5000 })
          .onAction()
          .pipe(take(1))
          .subscribe(() => this.unarchiveGarmentById(garment.id));
        
        // Reload garments to reflect the change
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
      },
      error: () => {
        this.isArchivingGarment.set(false);
        this.snackBar.open('Failed to archive garment', 'Dismiss', { duration: 3000 });
      }
    });
  }

  private unarchiveGarmentById(id: string): void {
    this.apiService.unarchiveGarment(id).pipe(take(1)).subscribe({
      next: () => {
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
        this.snackBar.open('Garment restored', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to restore garment', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onArchiveItemRestored(): void {
    // Refresh garments when an item is restored from the archive panel
    this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
  }
}

  // --- Archive Methods ---

  openArchivePanel(): void {
    this.isArchivePanelOpen.set(true);
  }

  closeArchivePanel(): void {
    this.isArchivePanelOpen.set(false);
  }

  archiveGarment(event: Event, garment: Garment): void {
    event.stopPropagation();
    if (this.isArchivingGarment()) return;

    this.isArchivingGarment.set(true);
    this.apiService.archiveGarment(garment.id).pipe(take(1)).subscribe({
      next: () => {
        this.isArchivingGarment.set(false);
        this.snackBar.open('Garment archived', 'Undo', { duration: 5000 })
          .onAction()
          .pipe(take(1))
          .subscribe(() => this.unarchiveGarmentById(garment.id));
        
        // Reload garments to reflect the change
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
      },
      error: () => {
        this.isArchivingGarment.set(false);
        this.snackBar.open('Failed to archive garment', 'Dismiss', { duration: 3000 });
      }
    });
  }

  private unarchiveGarmentById(id: string): void {
    this.apiService.unarchiveGarment(id).pipe(take(1)).subscribe({
      next: () => {
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
        this.snackBar.open('Garment restored', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to restore garment', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onArchiveItemRestored(): void {
    // Refresh garments when an item is restored from the archive panel
    this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
  }
}

const IMAGE_FALLBACK_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;