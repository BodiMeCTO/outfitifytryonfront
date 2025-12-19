import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { Garment, GarmentCategory } from '../../models/outfit';

type GarmentSelectionState = {
  top: Garment | null;
  bottom: Garment | null;
  fullBody: Garment | null;
  jacket: Garment | null;
  accessories: Garment | null;
};

type SizeSelectionState = {
  top: string | null;
  bottom: string | null;
  fullBody: string | null;
  jacket: string | null;
  accessories: string | null;
};

type ReviewEntry = {
  garment: Garment;
  category: 'tops' | 'bottoms';
};

const EMPTY_SELECTION: GarmentSelectionState = {
  top: null,
  bottom: null,
  fullBody: null,
  jacket: null,
  accessories: null
};

const EMPTY_SIZE_SELECTION: SizeSelectionState = {
  top: null,
  bottom: null,
  fullBody: null,
  jacket: null,
  accessories: null
};

const DEFAULT_TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const DEFAULT_BOTTOM_SIZES = ['28', '30', '32', '34', '36'];

@Component({
  selector: 'app-size-selection',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    RouterLink,
    MatCardModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressBarModule
  ],
  templateUrl: './size-selection.component.html',
  styleUrls: ['./size-selection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SizeSelectionComponent {
  private readonly outfitService = inject(OutfitService);
  private readonly snackBar = inject(MatSnackBar);

  readonly inspiration$ = this.outfitService.selectedInspiration$;

  // Snapshot of garments and sizes from the service (matches new OutfitService shape)
  readonly garments = toSignal(this.outfitService.selectedGarments$, {
    initialValue: EMPTY_SELECTION
  });

  readonly sizes = toSignal(this.outfitService.selectedSizes$, {
    initialValue: EMPTY_SIZE_SELECTION
  });

  readonly hasCompleteSelection = toSignal(this.outfitService.hasCompleteSelection$, {
    initialValue: false
  });

  // This review screen only shows top and bottom (not full-body / jacket / accessories)
  readonly selectedGarmentList = computed<ReviewEntry[]>(() => {
    const g = this.garments();
    const entries: ReviewEntry[] = [];

    if (g.top) {
      entries.push({ garment: g.top, category: 'tops' });
    }
    if (g.bottom) {
      entries.push({ garment: g.bottom, category: 'bottoms' });
    }

    return entries;
  });

  readonly topSizeOptions = computed(
    () => this.garments().top?.sizes ?? DEFAULT_TOP_SIZES
  );
  readonly bottomSizeOptions = computed(
    () => this.garments().bottom?.sizes ?? DEFAULT_BOTTOM_SIZES
  );

  readonly isSubmitting = signal(false);

  sizeOptions(category: GarmentCategory): readonly string[] {
    switch (category) {
      case 'tops':
        return this.topSizeOptions();
      case 'bottoms':
        return this.bottomSizeOptions();
      default:
        return [];
    }
  }

  selectedSize(category: GarmentCategory): string | null {
    const sizes = this.sizes();
    switch (category) {
      case 'tops':
        return sizes.top;
      case 'bottoms':
        return sizes.bottom;
      default:
        return null;
    }
  }

  handleSizeChange(category: GarmentCategory, event: MatButtonToggleChange): void {
    // We only expect 'tops' or 'bottoms' here
    this.outfitService.setSelectedSize(category, event.value ?? null);
  }

  createOutfit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (!this.hasCompleteSelection()) {
      this.snackBar.open(
        'Please make sure you have selected sizes for your outfit before continuing.',
        'OK',
        { duration: 3500 }
      );
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
            'Outfit creation started. We will notify you when images are ready.',
            'Nice!',
            { duration: 3500 }
          );
        },
        error: () => {
          this.isSubmitting.set(false);
          this.snackBar.open(
            'Unable to create your outfit with OutfitifyAPI right now.',
            'Dismiss',
            { duration: 4000 }
          );
        }
      });
  }
}
