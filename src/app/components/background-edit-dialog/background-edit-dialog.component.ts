import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';

import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { ASPECT_RATIO_OPTIONS, AspectRatioOption } from '../../models/outfit';
import { BackgroundImageDto } from '../../models/outfitify-api';

export interface BackgroundEditDialogData {
  sourceModelImageId: string;
  sourceImageUrl: string;
  sourceName?: string;
}

export interface BackgroundEditDialogResult {
  saved: boolean;
  newModelImage?: {
    id: string;
    imageUrl: string;
    name: string;
  };
}

@Component({
  selector: 'app-background-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  templateUrl: './background-edit-dialog.component.html',
  styleUrls: ['./background-edit-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackgroundEditDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BackgroundEditDialogComponent>);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data: BackgroundEditDialogData = inject(MAT_DIALOG_DATA);

  // Form state
  readonly backgroundPresets = signal<BackgroundImageDto[]>([]);
  readonly selectedPresetId = signal<string | null>(null);
  readonly customPrompt = signal('');
  readonly isCustomMode = signal(false);
  readonly selectedAspectRatio = signal<AspectRatioOption>('original');
  readonly isProcessing = signal(false);
  readonly isLoadingPresets = signal(true);

  // Aspect ratio options - includes 'original' to keep source image proportions
  readonly aspectRatioOptions = ASPECT_RATIO_OPTIONS;

  // Credit cost
  readonly creditCost = 5;

  ngOnInit(): void {
    this.loadBackgroundPresets();
  }

  private loadBackgroundPresets(): void {
    this.apiService.listBackgroundImages().pipe(take(1)).subscribe({
      next: (presets) => {
        // Filter to only active templates
        const activePresets = presets.filter(p => p.isActive !== false && p.isTemplate !== false);
        this.backgroundPresets.set(activePresets);
        this.isLoadingPresets.set(false);

        // Auto-select first preset if available
        if (activePresets.length > 0) {
          this.selectedPresetId.set(activePresets[0].backgroundImageId);
        } else {
          // No presets, default to custom mode
          this.isCustomMode.set(true);
        }
      },
      error: () => {
        this.isLoadingPresets.set(false);
        this.isCustomMode.set(true); // Fall back to custom mode on error
      }
    });
  }

  selectPreset(presetId: string): void {
    this.selectedPresetId.set(presetId);
    this.isCustomMode.set(false);
  }

  selectCustomMode(): void {
    this.selectedPresetId.set(null);
    this.isCustomMode.set(true);
  }

  isPresetSelected(presetId: string): boolean {
    return !this.isCustomMode() && this.selectedPresetId() === presetId;
  }

  // Get the effective prompt (from preset or custom)
  getEffectivePrompt(): string {
    if (this.isCustomMode()) {
      return this.customPrompt().trim();
    }
    const preset = this.backgroundPresets().find(p => p.backgroundImageId === this.selectedPresetId());
    return preset?.prompt || '';
  }

  selectAspectRatio(value: AspectRatioOption): void {
    this.selectedAspectRatio.set(value);
  }

  isAspectRatioSelected(value: AspectRatioOption): boolean {
    return this.selectedAspectRatio() === value;
  }

  canCreate(): boolean {
    if (this.isProcessing() || this.isLoadingPresets()) return false;

    // Either have a selected preset OR custom mode with a prompt
    if (this.isCustomMode()) {
      return this.customPrompt().trim().length > 0;
    }
    return this.selectedPresetId() !== null;
  }

  createBackgroundEdit(): void {
    if (!this.canCreate()) return;

    this.isProcessing.set(true);

    const payload: {
      sourceModelImageId: string;
      backgroundImageId?: string;
      backgroundPrompt?: string;
      aspectRatio?: string;
    } = {
      sourceModelImageId: this.data.sourceModelImageId,
      aspectRatio: this.selectedAspectRatio() !== 'original' ? this.selectedAspectRatio() : undefined
    };

    // Set either preset ID or custom prompt
    if (this.isCustomMode()) {
      payload.backgroundPrompt = this.customPrompt().trim();
    } else {
      payload.backgroundImageId = this.selectedPresetId() || undefined;
      // Also include the prompt from preset for logging/reference
      payload.backgroundPrompt = this.getEffectivePrompt();
    }

    this.apiService.createModelImageWithBackground(payload).pipe(take(1)).subscribe({
      next: (result) => {
        this.isProcessing.set(false);
        this.snackBar.open('Background edited successfully!', 'Great!', { duration: 3000 });
        this.dialogRef.close({
          saved: true,
          newModelImage: {
            id: result.modelImageId,
            imageUrl: result.imageUrl || '',
            name: result.name || 'Edited Background'
          }
        } as BackgroundEditDialogResult);
      },
      error: (err) => {
        this.isProcessing.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to edit background. Please try again.';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      }
    });
  }

  cancel(): void {
    this.dialogRef.close({ saved: false } as BackgroundEditDialogResult);
  }
}
