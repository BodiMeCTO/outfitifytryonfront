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
import { OutfitifyApiService } from '../../services/outfitify-api.service';
import {
  SelectedInspiration,
  Garment,
  GarmentGroup,
  AspectRatioOption,
  ASPECT_RATIO_OPTIONS,
  BackgroundPromptPreset,
  BACKGROUND_PROMPT_PRESETS,
  BackgroundCategory,
  BACKGROUND_CATEGORIES,
  PosePreset,
  POSE_PRESETS
} from '../../models/outfit';
import { LuxeButtonComponent } from '../shared/luxe-button/luxe-button.component';
import { LuxeImageCardComponent } from '../shared/luxe-image-card/luxe-image-card.component';
import { LuxeCarouselComponent } from '../shared/luxe-carousel/luxe-carousel.component';
import { GenerationProgressComponent } from '../shared/generation-progress/generation-progress.component';
import { SmartGarmentUploadDialogComponent } from '../smart-garment-upload-dialog/smart-garment-upload-dialog.component';
import { OnboardingTutorialComponent } from '../onboarding-tutorial/onboarding-tutorial.component';
import { ArchivePanelComponent } from '../archive-panel/archive-panel.component';
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
    GenerationProgressComponent,
    ArchivePanelComponent
  ],
  templateUrl: './studio.component.html',
  styleUrls: ['./studio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly tutorialService = inject(TutorialService);

  // Model image state
  readonly selectedModel$ = this.outfitService.selectedInspiration$;
  readonly userModels$ = this.outfitService.userModelImages$;
  readonly isUploadingModel = signal(false);
  readonly showTemplates = signal(this.loadShowTemplatesPreference());

  // Pose state
  readonly posePresets = POSE_PRESETS;
  readonly selectedPoseId = signal<string>('original');

  // Background prompt state (for AI-generated backgrounds)
  readonly backgroundPresets = BACKGROUND_PROMPT_PRESETS;
  readonly backgroundCategories = BACKGROUND_CATEGORIES;
  readonly aspectRatioOptions = ASPECT_RATIO_OPTIONS;
  readonly selectedPresetId = signal<string | null>(null);
  readonly customBackgroundPrompt = signal<string>('');
  readonly selectedAspectRatio = signal<AspectRatioOption>('original');
  readonly activeBackgroundCategory = signal<BackgroundCategory>('original');
  readonly expandedCategory = signal<BackgroundCategory | null>(null);

  // Filtered model images: only show original uploads (not background variants)
  // Also filters out templates when showTemplates is false
  get originalModelImages$() {
    return this.userModels$.pipe(
      map(models => {
        const filtered = models.filter(m => !m.isBackgroundVariant);
        if (!this.showTemplates()) {
          return filtered.filter(m => !m.isTemplate);
        }
        return filtered;
      })
    );
  }

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

  // Archive state
  readonly isArchivePanelOpen = signal(false);

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

  /**
   * Calculate credit cost for generation:
   * - Base try-on: 2 credits
   * - Pose change: +1 credit
   * - Background change: +1 credit
   */
  get generationCreditCost(): number {
    let cost = 2; // Base try-on cost
    if (this.selectedPoseId() !== 'original') {
      cost += 1; // Pose change
    }
    if (this.hasBackgroundSelection()) {
      cost += 1; // Background change
    }
    return cost;
  }

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

  // Background preset methods
  get filteredPresets(): BackgroundPromptPreset[] {
    const expanded = this.expandedCategory();
    if (!expanded || expanded === 'original') return [];
    return this.backgroundPresets.filter(p => p.category === expanded);
  }

  // Get the currently selected preset info for display
  get selectedPresetInfo(): { name: string; category: string } | null {
    const presetId = this.selectedPresetId();
    const customPrompt = this.customBackgroundPrompt().trim();

    if (presetId) {
      const preset = this.backgroundPresets.find(p => p.id === presetId);
      if (preset) {
        const category = this.backgroundCategories.find(c => c.id === preset.category);
        return { name: preset.name, category: category?.label || preset.category };
      }
    } else if (customPrompt) {
      return { name: 'Custom', category: 'Custom prompt' };
    }
    return null;
  }

  selectBackgroundCategory(category: BackgroundCategory): void {
    // Toggle expansion: if already expanded, collapse; otherwise expand
    if (this.expandedCategory() === category) {
      // Don't collapse, just keep it open
      return;
    }

    this.expandedCategory.set(category);

    // If selecting "original", clear any background selection
    if (category === 'original') {
      this.selectedPresetId.set(null);
      this.customBackgroundPrompt.set('');
      this.activeBackgroundCategory.set('original');
    } else {
      this.activeBackgroundCategory.set(category);
    }
  }

  selectPreset(preset: BackgroundPromptPreset): void {
    const currentId = this.selectedPresetId();
    if (currentId === preset.id) {
      // Deselect
      this.selectedPresetId.set(null);
      this.customBackgroundPrompt.set('');
    } else {
      // Select and copy prompt to custom field for visibility
      this.selectedPresetId.set(preset.id);
      this.customBackgroundPrompt.set(preset.prompt);
      this.activeBackgroundCategory.set(preset.category);
    }
  }

  isPresetSelected(presetId: string): boolean {
    return this.selectedPresetId() === presetId;
  }

  isCategoryExpanded(categoryId: BackgroundCategory): boolean {
    return this.expandedCategory() === categoryId;
  }

  clearBackgroundSelection(): void {
    this.selectedPresetId.set(null);
    this.customBackgroundPrompt.set('');
    this.expandedCategory.set('original');
    this.activeBackgroundCategory.set('original');
  }

  onCustomPromptChange(value: string): void {
    this.customBackgroundPrompt.set(value);
    // Clear preset selection when user types custom prompt
    if (value && this.selectedPresetId()) {
      const selectedPreset = this.backgroundPresets.find(p => p.id === this.selectedPresetId());
      if (selectedPreset && value !== selectedPreset.prompt) {
        this.selectedPresetId.set(null);
      }
    }
  }

  selectAspectRatio(ratio: AspectRatioOption): void {
    this.selectedAspectRatio.set(ratio);
  }

  // Pose selection methods
  selectPose(poseId: string): void {
    this.selectedPoseId.set(poseId);
  }

  isPoseSelected(poseId: string): boolean {
    return this.selectedPoseId() === poseId;
  }

  getSelectedPosePrompt(): string | null {
    const poseId = this.selectedPoseId();
    if (poseId === 'original') return null;
    const preset = this.posePresets.find(p => p.id === poseId);
    return preset?.prompt || null;
  }

  // Check if any background is selected (preset or custom prompt)
  hasBackgroundSelection(): boolean {
    return !!this.selectedPresetId() ||
           !!this.customBackgroundPrompt().trim();
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

  // Model methods - supports multiple file upload
  handleModelUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    // Filter to only image files
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.snackBar.open('Please select image files.', 'Dismiss', { duration: 4000 });
      input.value = '';
      return;
    }

    if (imageFiles.length < files.length) {
      this.snackBar.open(`${files.length - imageFiles.length} non-image file(s) skipped.`, undefined, { duration: 3000 });
    }

    this.isUploadingModel.set(true);
    let completedCount = 0;
    let errorCount = 0;

    // Upload each file
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const previewUrl = reader.result as string;
        this.outfitService
          .uploadAndSetInspiration(file, previewUrl)
          .pipe(take(1))
          .subscribe({
            next: () => {
              completedCount++;
              this.checkUploadCompletion(imageFiles.length, completedCount, errorCount);
            },
            error: () => {
              errorCount++;
              completedCount++;
              this.checkUploadCompletion(imageFiles.length, completedCount, errorCount);
            }
          });
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  private checkUploadCompletion(total: number, completed: number, errors: number): void {
    if (completed === total) {
      this.isUploadingModel.set(false);
      const successCount = total - errors;
      if (errors === 0) {
        this.snackBar.open(
          total === 1 ? 'Photo uploaded successfully.' : `${successCount} photos uploaded successfully.`,
          undefined,
          { duration: 2500 }
        );
      } else {
        this.snackBar.open(
          `${successCount} of ${total} photos uploaded. ${errors} failed.`,
          'Dismiss',
          { duration: 4000 }
        );
      }
    }
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

  // Generation
  generateOutfit(): void {
    this.isGenerating.set(true);
    this.generationProgress.set('Preparing your outfit...');

    // Set pose, background prompt, and aspect ratio in the service before creating outfit
    const posePrompt = this.getSelectedPosePrompt();
    const backgroundPrompt = this.customBackgroundPrompt().trim() || null;
    const aspectRatio = this.selectedAspectRatio();

    // Set the pose, prompt and aspect ratio in the outfit service
    this.outfitService.setPosePrompt(posePrompt);
    this.outfitService.setCustomBackgroundPrompt(backgroundPrompt);
    this.outfitService.setAspectRatio(aspectRatio);

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
      maxHeight: '90vh',
      panelClass: 'garment-upload-dialog',
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
          error: (err: any) => console.error('[StudioComponent] Error reloading garments:', err)
        });
        this.snackBar.open('Garment added successfully!', undefined, { duration: 2500 });
      }
    });
  }

  // --- Archive Methods ---

  openArchivePanel(): void {
    this.isArchivePanelOpen.set(true);
  }

  closeArchivePanel(): void {
    this.isArchivePanelOpen.set(false);
  }

  archiveModelImage(event: Event, model: SelectedInspiration): void {
    event.stopPropagation();
    if (!model.id) return;

    this.apiService.archiveModelImage(model.id).pipe(take(1)).subscribe({
      next: () => {
        this.outfitService.forceReloadUserModelImages().pipe(take(1)).subscribe();
        const snackRef = this.snackBar.open('Photo archived', 'Undo', { duration: 5000 });
        snackRef.onAction().pipe(take(1)).subscribe(() => {
          this.apiService.unarchiveModelImage(model.id!).pipe(take(1)).subscribe({
            next: () => this.outfitService.forceReloadUserModelImages().pipe(take(1)).subscribe()
          });
        });
      },
      error: () => {
        this.snackBar.open('Failed to archive photo', 'Dismiss', { duration: 3000 });
      }
    });
  }

  archiveGarment(event: Event, garment: Garment): void {
    event.stopPropagation();

    this.apiService.archiveGarment(garment.id).pipe(take(1)).subscribe({
      next: () => {
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
        const snackRef = this.snackBar.open('Garment archived', 'Undo', { duration: 5000 });
        snackRef.onAction().pipe(take(1)).subscribe(() => {
          this.apiService.unarchiveGarment(garment.id).pipe(take(1)).subscribe({
            next: () => this.outfitService.forceReloadGarments().pipe(take(1)).subscribe()
          });
        });
      },
      error: () => {
        this.snackBar.open('Failed to archive garment', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onArchiveItemRestored(): void {
    // Refresh both models and garments when an item is restored
    this.outfitService.forceReloadUserModelImages().pipe(take(1)).subscribe();
    this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
  }

  // Template visibility toggle methods
  toggleShowTemplates(): void {
    const newValue = !this.showTemplates();
    this.showTemplates.set(newValue);
    this.saveShowTemplatesPreference(newValue);
  }

  private loadShowTemplatesPreference(): boolean {
    const stored = localStorage.getItem('studio.showTemplates');
    return stored === null ? true : stored === 'true';
  }

  private saveShowTemplatesPreference(value: boolean): void {
    localStorage.setItem('studio.showTemplates', String(value));
  }
}
