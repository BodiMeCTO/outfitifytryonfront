import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { toSignal } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { GarmentCategoryDto } from '../../models/outfitify-api';
import {
  OutfitifyApiService,
  GarmentAnalysisResponse,
  GarmentClassification,
  GarmentExtractionItem,
  DetectedClothingRegion
} from '../../services/outfitify-api.service';

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
    MatInputModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    MatCheckboxModule,
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

  // Categories
  readonly garmentCategories = toSignal(this.outfitService.garmentCategories$, { initialValue: [] as GarmentCategoryDto[] });

  // Smart Garment Analysis
  readonly isAnalyzing = signal(false);
  readonly analysisResult = signal<GarmentAnalysisResponse | null>(null);
  readonly isSavingGarment = signal(false);
  private pendingFile: File | null = null;

  // User corrections/confirmations for analysis results
  readonly confirmedImageType = signal<'FlatLay' | 'PersonWearing' | null>(null);
  readonly confirmedGarmentName = signal<string>('');
  readonly confirmedCategoryId = signal<number | null>(null);
  readonly selectedRegions = signal<string[]>([]);
  private regionCategoryIds = new Map<string, number>();
  private regionCategories = new Map<string, string>(); // Keep for backwards compat

  // Saved garments count for success message
  private savedCount = 0;

  readonly garmentCategoryOptions = signal<GarmentCategoryDto[]>([]);

  constructor() {
    // Load categories on init
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
      }
    });
  }

  categoryId(category: GarmentCategoryDto | undefined): number | null {
    if (!category) return null;
    return category.garmentCategoryEntityId ?? (category as any).garmentCategoryEntityID ?? null;
  }

  categoryLabel(category: GarmentCategoryDto): string {
    const group = category.group || 'Category';
    const specific = category.category;
    return specific && specific !== group ? `${specific} • ${group}` : group;
  }

  handleSmartUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file.', 'Dismiss', { duration: 4000 });
      return;
    }

    this.pendingFile = file;
    this.isAnalyzing.set(true);
    this.analysisResult.set(null);
    this.confirmedImageType.set(null);
    this.confirmedGarmentName.set('');
    this.confirmedCategoryId.set(null);
    this.selectedRegions.set([]);
    this.regionCategories.clear();

    this.apiService.analyzeGarmentImage(file).pipe(take(1)).subscribe({
      next: (result) => {
        this.isAnalyzing.set(false);
        if (result.success) {
          this.analysisResult.set(result);
          this.confirmedImageType.set(result.detectedImageType as 'FlatLay' | 'PersonWearing');
          this.confirmedGarmentName.set(result.suggestedCategory || 'New Garment');
          this.confirmedCategoryId.set(result.suggestedCategoryId ?? null);

          if (result.detectedImageType === 'PersonWearing' && result.detectedRegions) {
            const regionIds = result.detectedRegions.map(r => r.region);
            this.selectedRegions.set(regionIds);
            result.detectedRegions.forEach(r => {
              this.regionCategories.set(r.region, r.suggestedGroup || 'tops');
              // Set default category ID based on suggested group
              const defaultCat = this.findDefaultCategoryForGroup(r.suggestedGroup || 'tops');
              if (defaultCat !== null) {
                this.regionCategoryIds.set(r.region, defaultCat);
              }
            });
          }
        } else {
          this.snackBar.open(result.errorMessage || 'Analysis failed.', 'Dismiss', { duration: 4000 });
        }
      },
      error: (err) => {
        this.isAnalyzing.set(false);
        const msg = err instanceof Error ? err.message : 'Failed to analyze image.';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      }
    });
  }

  saveAnalyzedGarment(): void {
    if (!this.pendingFile || !this.analysisResult()) return;

    const imageType = this.confirmedImageType();
    if (!imageType) return;

    this.isSavingGarment.set(true);

    let extractions: GarmentExtractionItem[] | undefined;
    if (imageType === 'PersonWearing' && this.selectedRegions().length > 0) {
      extractions = this.selectedRegions().map(region => {
        const categoryId = this.regionCategoryIds.get(region);
        const group = this.regionCategories.get(region) || 'tops';
        const categoryInfo = categoryId
          ? this.garmentCategoryOptions().find(c => this.categoryId(c) === categoryId)
          : null;
        const name = categoryInfo?.category || `Extracted ${group}`;
        return {
          region,
          garmentGroup: group,
          categoryId,
          name
        };
      });
    }

    this.apiService.saveAnalyzedGarment({
      file: this.pendingFile,
      imageType: imageType,
      garmentName: this.confirmedGarmentName() || 'New Garment',
      garmentGroup: this.analysisResult()?.suggestedGroup,
      categoryId: this.confirmedCategoryId() ?? undefined,
      extractions
    }).pipe(take(1)).subscribe({
      next: (result) => {
        this.isSavingGarment.set(false);
        if (result.success) {
          this.savedCount = result.savedGarments.length;
          this.snackBar.open(`Saved ${this.savedCount} garment(s)!`, 'Great!', { duration: 3000 });
          this.dialogRef.close({ saved: true, count: this.savedCount });
        } else {
          this.snackBar.open(result.errorMessage || 'Save failed.', 'Dismiss', { duration: 4000 });
        }
      },
      error: (err) => {
        this.isSavingGarment.set(false);
        const msg = err instanceof Error ? err.message : 'Failed to save garment.';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      }
    });
  }

  clearAnalysis(): void {
    this.analysisResult.set(null);
    this.confirmedImageType.set(null);
    this.confirmedGarmentName.set('');
    this.confirmedCategoryId.set(null);
    this.selectedRegions.set([]);
    this.regionCategories.clear();
    this.regionCategoryIds.clear();
    this.pendingFile = null;
  }

  getAlternativeClassifications(): GarmentClassification[] {
    return this.analysisResult()?.alternativeClassifications || [];
  }

  selectAlternativeClassification(classification: GarmentClassification): void {
    const matchingCat = this.garmentCategoryOptions().find(c =>
      c.group?.toLowerCase() === classification.group.toLowerCase()
    );
    if (matchingCat) {
      this.confirmedCategoryId.set(this.categoryId(matchingCat));
      this.confirmedGarmentName.set(classification.label);
    }
  }

  isRegionSelected(region: string): boolean {
    return this.selectedRegions().includes(region);
  }

  toggleRegionSelection(regionItem: DetectedClothingRegion): void {
    const region = regionItem.region;
    const current = this.selectedRegions();
    if (current.includes(region)) {
      this.selectedRegions.set(current.filter(r => r !== region));
    } else {
      this.selectedRegions.set([...current, region]);
      if (!this.regionCategories.has(region)) {
        const group = regionItem.suggestedGroup || 'tops';
        this.regionCategories.set(region, group);
        const defaultCat = this.findDefaultCategoryForGroup(group);
        if (defaultCat !== null) {
          this.regionCategoryIds.set(region, defaultCat);
        }
      }
    }
  }

  getRegionCategory(region: string): string {
    return this.regionCategories.get(region) || 'tops';
  }

  setRegionCategory(region: string, category: string): void {
    this.regionCategories.set(region, category);
  }

  getRegionCategoryId(region: string): number | null {
    return this.regionCategoryIds.get(region) ?? null;
  }

  setRegionCategoryId(region: string, categoryId: number): void {
    this.regionCategoryIds.set(region, categoryId);
    // Also update the group based on the selected category
    const cat = this.garmentCategoryOptions().find(c => this.categoryId(c) === categoryId);
    if (cat?.group) {
      this.regionCategories.set(region, cat.group);
    }
  }

  private findDefaultCategoryForGroup(group: string): number | null {
    const normalizedGroup = group.toLowerCase();
    const cat = this.garmentCategoryOptions().find(c =>
      c.group?.toLowerCase() === normalizedGroup
    );
    return cat ? this.categoryId(cat) : null;
  }

  cancel(): void {
    this.dialogRef.close({ saved: false });
  }
}
