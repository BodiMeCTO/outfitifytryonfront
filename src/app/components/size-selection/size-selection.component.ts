import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { Garment, GarmentGroup } from '../../models/outfit';

type GarmentSelectionState = {
  top: Garment[];
  bottom: Garment[];
  fullBody: Garment[];
  jacket: Garment[];
  accessories: Garment[];
};

type SizeSelectionState = {
  top: Record<string, string | null>;
  bottom: Record<string, string | null>;
  fullBody: Record<string, string | null>;
  jacket: Record<string, string | null>;
  accessories: Record<string, string | null>;
};

type ReviewEntry = {
  garment: Garment;
  group: 'tops' | 'bottoms';
};

const EMPTY_SELECTION: GarmentSelectionState = {
  top: [],
  bottom: [],
  fullBody: [],
  jacket: [],
  accessories: []
};

const EMPTY_SIZE_SELECTION: SizeSelectionState = {
  top: {},
  bottom: {},
  fullBody: {},
  jacket: {},
  accessories: {}
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
  private readonly router = inject(Router);

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

    if (g.top && g.top.length > 0) {
      g.top.forEach(garment => {
        entries.push({ garment, group: 'tops' });
      });
    }
    if (g.bottom && g.bottom.length > 0) {
      g.bottom.forEach(garment => {
        entries.push({ garment, group: 'bottoms' });
      });
    }

    return entries;
  });

  readonly topSizeOptions = computed(
    () => this.garments().top?.[0]?.sizes ?? DEFAULT_TOP_SIZES
  );
  readonly bottomSizeOptions = computed(
    () => this.garments().bottom?.[0]?.sizes ?? DEFAULT_BOTTOM_SIZES
  );

  readonly isSubmitting = signal(false);

  sizeOptions(group: GarmentGroup): readonly string[] {
    switch (group) {
      case 'tops':
        return this.topSizeOptions();
      case 'bottoms':
        return this.bottomSizeOptions();
      default:
        return [];
    }
  }

  selectedSize(group: GarmentGroup): string | null {
    const sizes = this.sizes();
    if (!sizes) return null;
    
    switch (group) {
      case 'tops':
        const topGarments = this.garments().top;
        return topGarments && topGarments.length > 0 
          ? (sizes.top[topGarments[0].id] ?? null)
          : null;
      case 'bottoms':
        const bottomGarments = this.garments().bottom;
        return bottomGarments && bottomGarments.length > 0 
          ? (sizes.bottom[bottomGarments[0].id] ?? null)
          : null;
      default:
        return null;
    }
  }

  handleSizeChange(group: GarmentGroup, event: MatButtonToggleChange): void {
    // We only expect 'tops' or 'bottoms' here
    const garments = group === 'tops' ? this.garments().top : this.garments().bottom;
    if (garments && garments.length > 0) {
      this.outfitService.setSelectedSize(group, garments[0].id, event.value ?? null);
    }
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
            'Outfit creation started!',
            'Nice!',
            { duration: 3500 }
          );
          this.router.navigate(['/generated-gallery']);
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
