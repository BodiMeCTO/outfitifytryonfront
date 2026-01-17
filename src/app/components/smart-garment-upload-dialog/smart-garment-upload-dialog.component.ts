import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { toSignal } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { GarmentCategoryDto } from '../../models/outfitify-api';
import {
  OutfitifyApiService,
  GarmentAnalysisResponse
} from '../../services/outfitify-api.service';

// Represents a pending garment in the batch upload queue
interface PendingGarment {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'ready' | 'saving' | 'saved' | 'error';
  analysisResult: GarmentAnalysisResponse | null;
  selectedGroup: string | null;
  selectedCategoryId: number | null;
  errorMessage: string | null;
}

// Format group names nicely for display
const GROUP_DISPLAY_NAMES: Record<string, string> = {
  'tops': 'Tops',
  'bottoms': 'Bottoms',
  'jackets': 'Jackets & Outerwear',
  'full-body': 'Full Body',
  'footwear': 'Footwear',
  'accessories': 'Accessories'
};

@Component({
  selector: 'app-smart-garment-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './smart-garment-upload-dialog.component.html',
  styleUrls: ['./smart-garment-upload-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SmartGarmentUploadDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SmartGarmentUploadDialogComponent>);
  private readonly outfitService = inject(OutfitService);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly garmentCategories = toSignal(this.outfitService.garmentCategories$, { initialValue: [] as GarmentCategoryDto[] });

  // Batch upload state
  readonly pendingGarments = signal<PendingGarment[]>([]);
  readonly garmentCategoryOptions = signal<GarmentCategoryDto[]>([]);
  readonly isSavingAll = signal(false);

  // Computed: unique groups from categories
  readonly uniqueGroups = computed(() => {
    const categories = this.garmentCategoryOptions();
    const groups = new Set<string>();
    categories.forEach(cat => {
      if (cat.group) {
        groups.add(cat.group.toLowerCase());
      }
    });
    // Return in preferred order
    const orderedGroups = ['tops', 'jackets', 'bottoms', 'full-body', 'footwear', 'accessories'];
    return orderedGroups.filter(g => groups.has(g));
  });

  // Computed states
  readonly hasGarments = computed(() => this.pendingGarments().length > 0);
  readonly allReady = computed(() => {
    const garments = this.pendingGarments();
    return garments.length > 0 && garments.every(g => g.status === 'ready' || g.status === 'saved');
  });
  readonly readyCount = computed(() => this.pendingGarments().filter(g => g.status === 'ready').length);
  readonly savedCount = computed(() => this.pendingGarments().filter(g => g.status === 'saved').length);
  readonly analyzingCount = computed(() => this.pendingGarments().filter(g => g.status === 'analyzing').length);

  private idCounter = 0;

  constructor() {
    this.outfitService.ensureGarmentCategoriesLoaded().pipe(take(1)).subscribe({
      next: (cats) => {
        const sorted = [...cats].sort((a, b) => {
          const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          const groupA = (a.group ?? '').toLowerCase();
          const groupB = (b.group ?? '').toLowerCase();
          if (groupA !== groupB) return groupA.localeCompare(groupB);
          return (a.category ?? '').toLowerCase().localeCompare(b.category ?? '');
        });
        this.garmentCategoryOptions.set(sorted);
      },
      error: (err) => {
        console.error('[SmartGarmentUpload] Failed to load categories:', err);
      }
    });
  }

  categoryId(category: GarmentCategoryDto | undefined): number | null {
    if (!category) return null;
    return category.garmentCategoryEntityID ?? category.garmentCategoryEntityId ?? null;
  }

  categoryLabel(category: GarmentCategoryDto): string {
    // Just show the specific category name, no group suffix needed since we have group dropdown
    return category.category || 'Unknown';
  }

  // Get display name for a group
  getGroupDisplayName(group: string): string {
    return GROUP_DISPLAY_NAMES[group.toLowerCase()] || group;
  }

  // Get categories filtered by group
  getCategoriesForGroup(group: string | null): GarmentCategoryDto[] {
    if (!group) return [];
    const normalizedGroup = group.toLowerCase();
    return this.garmentCategoryOptions().filter(
      cat => cat.group?.toLowerCase() === normalizedGroup
    );
  }

  // Handle multiple file selection
  handleFileSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0) {
      input.value = '';
      return;
    }

    // Extract files BEFORE clearing the input (clearing input clears the FileList reference)
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    input.value = ''; // Clear input AFTER extracting files
    if (imageFiles.length === 0) {
      this.snackBar.open('Please select image files.', 'Dismiss', { duration: 4000 });
      return;
    }

    // Add each file to the pending queue and start analyzing
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const previewUrl = reader.result as string;
        const garment: PendingGarment = {
          id: `garment-${++this.idCounter}`,
          file,
          previewUrl,
          status: 'pending',
          analysisResult: null,
          selectedGroup: null,
          selectedCategoryId: null,
          errorMessage: null
        };

        // Add to queue
        this.pendingGarments.update(list => [...list, garment]);

        // Start analysis
        this.analyzeGarment(garment.id);
      };
      reader.readAsDataURL(file);
    });
  }

  // Analyze a single garment
  private analyzeGarment(garmentId: string): void {
    const garment = this.pendingGarments().find(g => g.id === garmentId);
    if (!garment) return;

    this.updateGarment(garmentId, { status: 'analyzing' });

    this.apiService.analyzeGarmentImage(garment.file).pipe(take(1)).subscribe({
      next: (result) => {
        if (result.success) {
          this.updateGarment(garmentId, {
            status: 'ready',
            analysisResult: result,
            selectedGroup: result.suggestedGroup ?? null,
            selectedCategoryId: result.suggestedCategoryId ?? null
          });
        } else {
          this.updateGarment(garmentId, {
            status: 'error',
            errorMessage: result.errorMessage || 'Analysis failed'
          });
        }
      },
      error: (err) => {
        const msg = err instanceof Error ? err.message : 'Failed to analyze image';
        this.updateGarment(garmentId, { status: 'error', errorMessage: msg });
      }
    });
  }

  // Update a garment in the list
  private updateGarment(garmentId: string, updates: Partial<PendingGarment>): void {
    this.pendingGarments.update(list =>
      list.map(g => g.id === garmentId ? { ...g, ...updates } : g)
    );
  }

  // Update group for a garment (resets category)
  updateGroup(garmentId: string, group: string | null): void {
    // When group changes, reset category to first in group or null
    const categories = this.getCategoriesForGroup(group);
    const firstCategoryId = categories.length > 0 ? this.categoryId(categories[0]) : null;
    this.updateGarment(garmentId, {
      selectedGroup: group,
      selectedCategoryId: firstCategoryId
    });
  }

  // Update category for a garment
  updateCategory(garmentId: string, categoryId: number | null): void {
    this.updateGarment(garmentId, { selectedCategoryId: categoryId });
  }

  // Remove a garment from the queue
  removeGarment(garmentId: string): void {
    this.pendingGarments.update(list => list.filter(g => g.id !== garmentId));
  }

  // Retry analysis for a failed garment
  retryAnalysis(garmentId: string): void {
    this.updateGarment(garmentId, { status: 'pending', errorMessage: null });
    this.analyzeGarment(garmentId);
  }

  // Save all ready garments
  saveAll(): void {
    const readyGarments = this.pendingGarments().filter(g => g.status === 'ready');
    if (readyGarments.length === 0) return;

    this.isSavingAll.set(true);
    let savedCount = 0;
    let errorCount = 0;
    const totalToSave = readyGarments.length;

    readyGarments.forEach(garment => {
      this.updateGarment(garment.id, { status: 'saving' });

      this.apiService.saveAnalyzedGarment({
        file: garment.file,
        imageType: 'FlatLay',
        garmentName: undefined,
        garmentGroup: garment.analysisResult?.suggestedGroup,
        categoryId: garment.selectedCategoryId ?? undefined,
        extractions: undefined
      }).pipe(take(1)).subscribe({
        next: (result) => {
          if (result.success) {
            this.updateGarment(garment.id, { status: 'saved' });
            savedCount++;
          } else {
            this.updateGarment(garment.id, {
              status: 'error',
              errorMessage: result.errorMessage || 'Save failed'
            });
            errorCount++;
          }
          this.checkSaveCompletion(totalToSave, savedCount + errorCount, savedCount);
        },
        error: (err) => {
          const msg = err instanceof Error ? err.message : 'Failed to save garment';
          this.updateGarment(garment.id, { status: 'error', errorMessage: msg });
          errorCount++;
          this.checkSaveCompletion(totalToSave, savedCount + errorCount, savedCount);
        }
      });
    });
  }

  private checkSaveCompletion(total: number, completed: number, saved: number): void {
    if (completed === total) {
      this.isSavingAll.set(false);

      // Check if all garments are now saved
      const allSaved = this.pendingGarments().every(g => g.status === 'saved');

      if (allSaved) {
        this.snackBar.open(
          `${saved} garment${saved > 1 ? 's' : ''} saved successfully!`,
          'Great!',
          { duration: 3000 }
        );
        this.dialogRef.close({ saved: true, count: saved });
      } else if (saved > 0) {
        this.snackBar.open(
          `${saved} of ${total} garments saved. Some had errors.`,
          'OK',
          { duration: 4000 }
        );
      }
    }
  }

  // Get preview image for a garment (use analysis result if available)
  getPreviewImage(garment: PendingGarment): string {
    if (garment.analysisResult?.previewImageBase64) {
      return 'data:image/png;base64,' + garment.analysisResult.previewImageBase64;
    }
    return garment.previewUrl;
  }

  // Get category name for display
  getCategoryName(categoryId: number | null): string {
    if (!categoryId) return 'Select category';
    const cat = this.garmentCategoryOptions().find(c => this.categoryId(c) === categoryId);
    return cat ? this.categoryLabel(cat) : 'Unknown';
  }

  cancel(): void {
    const saved = this.savedCount();
    this.dialogRef.close({ saved: saved > 0, count: saved });
  }

  clearAll(): void {
    this.pendingGarments.set([]);
  }
}
