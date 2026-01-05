import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { take, map } from 'rxjs/operators';
import { combineLatest } from 'rxjs';

import { OutfitService } from '../../services/outfit.service';
import { SelectedInspiration, Garment, GarmentGroup } from '../../models/outfit';
import { LuxeButtonComponent } from '../shared/luxe-button/luxe-button.component';
import { LuxeImageCardComponent } from '../shared/luxe-image-card/luxe-image-card.component';
import { LuxeCarouselComponent } from '../shared/luxe-carousel/luxe-carousel.component';
import { GenerationProgressComponent } from '../shared/generation-progress/generation-progress.component';
import { SmartGarmentUploadDialogComponent } from '../smart-garment-upload-dialog/smart-garment-upload-dialog.component';
import {
  BackgroundEditDialogComponent,
  BackgroundEditDialogData,
  BackgroundEditDialogResult
} from '../background-edit-dialog/background-edit-dialog.component';
import { OnboardingTutorialComponent } from '../onboarding-tutorial/onboarding-tutorial.component';
import { TutorialService } from '../../services/tutorial.service';

// Group display config
interface GroupConfig {
  key: GarmentGroup;
  label: string;
}

const GARMENT_GROUPS: GroupConfig[] = [
  { key: 'tops', label: 'Tops' },
  { key: 'bottoms', label: 'Bottoms' },
  { key: 'full-body', label: 'Full Body' },
  { key: 'jackets', label: 'Jackets' },
  { key: 'accessories', label: 'Accessories' }
];

@Component({
  standalone: true,
  selector: 'app-studio',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    LuxeButtonComponent,
    LuxeImageCardComponent,
    LuxeCarouselComponent,
    GenerationProgressComponent
  ],
  templateUrl: './studio.component.html',
  styleUrls: ['./studio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly tutorialService = inject(TutorialService);

  // Model image state
  readonly selectedModel$ = this.outfitService.selectedInspiration$;
  readonly userModels$ = this.outfitService.userModelImages$;
  readonly isUploadingModel = signal(false);

  // Filtered model images: original uploads vs background-edited variants
  readonly originalModelImages$ = this.userModels$.pipe(
    map(models => models.filter(m => !m.isBackgroundVariant))
  );
  readonly editedModelImages$ = this.userModels$.pipe(
    map(models => models.filter(m => m.isBackgroundVariant))
  );

  // Garment state
  readonly garments$ = this.outfitService.garments$;
  readonly selectedGarments$ = this.outfitService.selectedGarments$;

  // Group garments by their group property
  readonly garmentsByGroup$ = this.garments$.pipe(
    map(garments => {
      const groups: Record<GarmentGroup, Garment[]> = {
        'tops': [],
        'bottoms': [],
        'full-body': [],
        'jackets': [],
        'accessories': []
      };
      garments.forEach(g => {
        const group = g.group;
        if (groups[group]) {
          groups[group].push(g);
        }
      });
      return groups;
    })
  );

  // UI state
  readonly garmentGroups = GARMENT_GROUPS;

  // Generation state
  readonly isGenerating = signal(false);
  readonly generationProgress = signal<string | null>(null);

  // Computed: can generate?
  readonly canGenerate$ = combineLatest([
    this.selectedModel$,
    this.outfitService.hasCompleteGarmentSelection$
  ]).pipe(
    map(([model, hasGarments]) => !!model && hasGarments)
  );

  // Count selected garments
  readonly selectedGarmentCount$ = this.selectedGarments$.pipe(
    map(garments =>
      garments.top.length +
      garments.bottom.length +
      garments.fullBody.length +
      garments.jacket.length +
      garments.accessories.length
    )
  );

  // Calculate credit cost for generation: 1 (base) + garment count
  readonly generationCreditCost$ = this.selectedGarmentCount$.pipe(
    map(garmentCount => 1 + garmentCount)
  );

  ngOnInit(): void {
    // Load model images
    this.outfitService
      .ensureUserModelImagesLoaded()
      .pipe(take(1))
      .subscribe({
        error: (err: unknown) => console.error('Failed to load user model images', err)
      });

    // Load garments
    this.outfitService
      .ensureGarmentsLoaded()
      .pipe(take(1))
      .subscribe({
        error: (err: unknown) => console.error('Failed to load garments', err)
      });

    // Check for first-time user and show tutorial
    this.checkFirstTimeUser();
  }

  private checkFirstTimeUser(): void {
    // Skip if tutorial was already completed
    if (this.tutorialService.isTutorialCompleted()) return;

    // Wait for data to load, then check if user has no content
    combineLatest([
      this.outfitService.ensureUserModelImagesLoaded(),
      this.outfitService.ensureGarmentsLoaded()
    ]).pipe(take(1)).subscribe(([models, garments]) => {
      // Show tutorial only if user has no model images AND no garments
      if (models.length === 0 && garments.length === 0) {
        this.openTutorialDialog();
      }
    });
  }

  private openTutorialDialog(): void {
    this.dialog.open(OnboardingTutorialComponent, {
      disableClose: true,
      panelClass: 'tutorial-dialog-panel',
      maxWidth: '100vw',
      width: '100%',
      height: '100%'
    });
  }

  // Model methods
  handleModelUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file.', 'Dismiss', { duration: 4000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = reader.result as string;
      this.isUploadingModel.set(true);
      this.outfitService
        .uploadAndSetInspiration(file, previewUrl)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.isUploadingModel.set(false);
            this.snackBar.open('Photo uploaded successfully.', undefined, { duration: 2500 });
          },
          error: (err: unknown) => {
            this.isUploadingModel.set(false);
            const message = err instanceof Error ? err.message : 'Unable to upload photo.';
            this.snackBar.open(message, 'Dismiss', { duration: 4000 });
          }
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  selectModel(model: SelectedInspiration): void {
    this.outfitService.setInspiration(model);
    if (model.id) {
      this.outfitService.setSelectedModel({ id: model.id });
    }
  }

  // Garment methods - use toggleSelectedGarment for multi-selection support
  // Limits: 2 tops, 2 bottoms, 1 full-body, 2 jackets, 3 accessories
  toggleGarment(garment: Garment): void {
    this.outfitService.toggleSelectedGarment(garment.group, garment);
  }

  isGarmentSelected(garment: Garment): boolean {
    return this.outfitService.isGarmentSelected(garment.group, garment.id);
  }

  // Background edit dialog
  openBackgroundEditDialog(model: SelectedInspiration): void {
    if (!model.id || !model.remoteUrl) {
      this.snackBar.open('Please select a model image first.', 'Dismiss', { duration: 3000 });
      return;
    }

    const dialogData: BackgroundEditDialogData = {
      sourceModelImageId: model.id,
      sourceImageUrl: model.remoteUrl || model.previewUrl,
      sourceName: model.name
    };

    const dialogRef = this.dialog.open(BackgroundEditDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: dialogData,
      disableClose: false
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe((result: BackgroundEditDialogResult | undefined) => {
      if (result?.saved && result.newModelImage) {
        // Force reload model images to show the new edited background
        this.outfitService.forceReloadUserModelImages().pipe(take(1)).subscribe({
          next: () => {
            this.snackBar.open('Background edited! New image added to your library.', undefined, { duration: 3000 });
          },
          error: (err) => console.error('Failed to reload model images:', err)
        });
      }
    });
  }

  // Generation
  generateOutfit(): void {
    this.isGenerating.set(true);
    this.generationProgress.set('Preparing your outfit...');

    this.outfitService.createOutfit().pipe(take(1)).subscribe({
      next: () => {
        this.generationProgress.set('Generation started!');
        setTimeout(() => {
          this.isGenerating.set(false);
          this.generationProgress.set(null);
          this.snackBar.open('Outfit generation started!', 'Nice!', {
            duration: 3500
          });
          this.router.navigate(['/generated-gallery']);
        }, 1000);
      },
      error: () => {
        this.isGenerating.set(false);
        this.generationProgress.set(null);
        this.snackBar.open('Failed to start generation. Please try again.', 'Dismiss', {
          duration: 4000
        });
      }
    });
  }

  // Garment upload dialog
  openGarmentUploadDialog(): void {
    const dialogRef = this.dialog.open(SmartGarmentUploadDialogComponent, {
      width: '450px',
      maxWidth: '95vw',
      disableClose: false
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe(result => {
      console.log('[StudioComponent] Dialog closed with result:', result);
      if (result?.saved) {
        console.log('[StudioComponent] Calling forceReloadGarments...');
        // Force reload garments to show newly added ones
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe({
          next: (garments) => {
            console.log('[StudioComponent] Garments reloaded:', garments?.length, 'items');
            console.log('[StudioComponent] Garments by group:', garments?.reduce((acc, g) => {
              acc[g.group] = (acc[g.group] || 0) + 1;
              return acc;
            }, {} as Record<string, number>));
          },
          error: (err) => console.error('[StudioComponent] Error reloading garments:', err)
        });
        this.snackBar.open('Garment added successfully!', undefined, { duration: 2500 });
      }
    });
  }
}
