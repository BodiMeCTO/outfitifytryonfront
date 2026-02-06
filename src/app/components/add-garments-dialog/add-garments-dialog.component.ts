import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';

import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { OutfitService } from '../../services/outfit.service';
import { Garment, GarmentGroup, OutfitGarmentInfo } from '../../models/outfit';

export interface AddGarmentsDialogData {
  outfitId: string;
  existingGarments: OutfitGarmentInfo[];
}

export interface AddGarmentsDialogResult {
  created: boolean;
  newOutfitId?: string;
}

@Component({
  selector: 'app-add-garments-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './add-garments-dialog.component.html',
  styleUrls: ['./add-garments-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddGarmentsDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddGarmentsDialogComponent>);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly outfitService = inject(OutfitService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data: AddGarmentsDialogData = inject(MAT_DIALOG_DATA);

  // All available garments
  readonly garments = toSignal(this.outfitService.garments$, { initialValue: [] as Garment[] });

  // Selected additional garments
  readonly selectedGarments = signal<Garment[]>([]);

  // State
  readonly isLoading = signal(false);
  readonly isCreating = signal(false);

  // Garment group tabs
  readonly groupTabs: { value: GarmentGroup; label: string }[] = [
    { value: 'tops', label: 'Tops' },
    { value: 'bottoms', label: 'Bottoms' },
    { value: 'full-body', label: 'Full Body' },
    { value: 'jackets', label: 'Jackets' },
    { value: 'footwear', label: 'Footwear' },
    { value: 'accessories', label: 'Accessories' }
  ];

  readonly selectedTab = signal<GarmentGroup>('tops');

  // Existing garment IDs (to exclude from selection)
  readonly existingGarmentIds = computed(() => {
    return new Set(this.data.existingGarments.map(g => g.id));
  });

  // Filtered garments for current tab (excluding already in outfit)
  readonly filteredGarments = computed(() => {
    const all = this.garments();
    const tab = this.selectedTab();
    const existingIds = this.existingGarmentIds();
    return all.filter(g => g.group === tab && !existingIds.has(g.id));
  });

  // Check if a garment is selected
  isSelected(garment: Garment): boolean {
    return this.selectedGarments().some(g => g.id === garment.id);
  }

  // Check if any garments are selected
  readonly hasSelections = computed(() => this.selectedGarments().length > 0);

  ngOnInit(): void {
    // Ensure garments are loaded
    this.isLoading.set(true);
    this.outfitService.ensureGarmentsLoaded().pipe(take(1)).subscribe({
      next: () => this.isLoading.set(false),
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to load garments', 'Dismiss', { duration: 3000 });
      }
    });
  }

  selectTab(group: GarmentGroup): void {
    this.selectedTab.set(group);
  }

  toggleGarment(garment: Garment): void {
    const current = this.selectedGarments();
    const index = current.findIndex(g => g.id === garment.id);
    if (index >= 0) {
      // Remove
      this.selectedGarments.set([...current.slice(0, index), ...current.slice(index + 1)]);
    } else {
      // Add
      this.selectedGarments.set([...current, garment]);
    }
  }

  removeSelected(garment: Garment): void {
    const current = this.selectedGarments();
    this.selectedGarments.set(current.filter(g => g.id !== garment.id));
  }

  createOutfit(): void {
    if (this.isCreating() || !this.hasSelections()) return;

    this.isCreating.set(true);
    const additionalGarments = this.selectedGarments().map(g => ({
      garmentEntityId: g.id,
      garmentSizeEntityId: undefined
    }));

    this.apiService.addGarmentsToOutfit(this.data.outfitId, additionalGarments).pipe(take(1)).subscribe({
      next: (newOutfit) => {
        this.isCreating.set(false);
        this.dialogRef.close({
          created: true,
          newOutfitId: newOutfit.id
        } as AddGarmentsDialogResult);
      },
      error: (err) => {
        this.isCreating.set(false);
        const message = err?.error?.error || 'Failed to create outfit. Please try again.';
        this.snackBar.open(message, 'Dismiss', { duration: 4000 });
      }
    });
  }

  cancel(): void {
    this.dialogRef.close({ created: false });
  }
}
