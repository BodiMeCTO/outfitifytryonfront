import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  ViewChild,
  ElementRef,
  effect
} from '@angular/core';
import { CommonModule, LowerCasePipe } from '@angular/common';
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
import { CreditsService } from '../../services/credits.service';
import { TutorialService } from '../../services/tutorial.service';
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
import { ArchivePanelComponent } from '../archive-panel/archive-panel.component';
import { WelcomeDialogComponent } from '../shared/welcome-dialog/welcome-dialog.component';
import { AiDisclaimerComponent } from '../shared/ai-disclaimer/ai-disclaimer.component';

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
  { key: 'footwear', label: 'Footwear' },
  { key: 'accessories', label: 'Accessories' }
];

@Component({
  standalone: true,
  selector: 'app-studio',
  imports: [
    CommonModule,
    LowerCasePipe,
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
    ArchivePanelComponent,
    AiDisclaimerComponent
  ],
  templateUrl: './studio.component.html',
  styleUrls: ['./studio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly apiService = inject(OutfitifyApiService);
  private readonly creditsService = inject(CreditsService);
  private readonly tutorialService = inject(TutorialService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  // Tutorial mode state
  readonly isTutorialActive = this.tutorialService.isTutorialActive;
  readonly tutorialStep = this.tutorialService.tutorialStep;
  readonly isSimplifiedFlow = this.tutorialService.isSimplifiedFlow;
  readonly isFullWalkthrough = this.tutorialService.isFullWalkthrough;
  readonly showAdvancedOptions = signal(this.tutorialService.hasCreatedFirstOutfit());

  // Mobile section navigation
  readonly mobileActiveSection = signal<'model' | 'pose' | 'background' | 'ratio' | 'garments'>('model');
  readonly mobileGarmentCategory = signal<'all' | 'tops' | 'bottoms' | 'full-body' | 'jackets' | 'footwear' | 'accessories'>('all');

  // Switch mobile section
  setMobileSection(section: 'model' | 'pose' | 'background' | 'ratio' | 'garments'): void {
    this.mobileActiveSection.set(section);
  }

  // Handle mobile tab click with tutorial awareness
  onMobileTabClick(section: 'model' | 'pose' | 'background' | 'ratio' | 'garments'): void {
    this.setMobileSection(section);
    // Auto-scroll to top when switching tabs (#24)
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  // Advance mobile walkthrough and switch to appropriate tab
  nextMobileWalkthroughStep(event: Event): void {
    event.stopPropagation();
    const currentStep = this.tutorialStep();

    // Map tutorial steps to mobile tabs
    const stepToTab: Record<string, 'model' | 'pose' | 'background' | 'ratio' | 'garments'> = {
      'models-full': 'pose',
      'pose-full': 'background',
      'background-full': 'ratio',
      'aspect-ratio-full': 'garments',
      'garments-full': 'garments' // Final step, stays on garments
    };

    // Advance the tutorial
    this.tutorialService.nextWalkthroughStep();

    // Switch to the next tab (unless it's the final step)
    const nextTab = stepToTab[currentStep];
    if (nextTab && currentStep !== 'garments-full') {
      this.setMobileSection(nextTab);
    }
  }

  // Switch garment sub-category
  setMobileGarmentCategory(category: 'all' | 'tops' | 'bottoms' | 'full-body' | 'jackets' | 'footwear' | 'accessories'): void {
    this.mobileGarmentCategory.set(category);
  }

  // Get garments for mobile category (excludes 'all' which is handled separately in template)
  getMobileGarmentCategory(): GarmentGroup {
    const cat = this.mobileGarmentCategory();
    return cat === 'all' ? 'tops' : cat;
  }

  // Get walkthrough step info for display
  getWalkthroughStepNumber(): number {
    return this.tutorialService.getWalkthroughStepNumber();
  }

  getTotalWalkthroughSteps(): number {
    return this.tutorialService.getTotalWalkthroughSteps();
  }

  // Advance to next walkthrough step
  nextWalkthroughStep(): void {
    this.tutorialService.nextWalkthroughStep();
  }

  // Skip the walkthrough entirely
  skipWalkthrough(): void {
    this.tutorialService.skipWalkthrough();
  }

  // Navigate to gallery
  goToGallery(): void {
    this.router.navigate(['/generated-gallery']);
  }

  // Model image state
  readonly selectedModel$ = this.outfitService.selectedInspiration$;
  readonly selectedModels$ = this.outfitService.selectedModels$;
  readonly selectedModelCount$ = this.outfitService.selectedModelCount$;
  readonly maxSelectedModels = this.outfitService.getMaxSelectedModels();
  readonly userModels$ = this.outfitService.userModelImages$;
  readonly isUploadingModel = signal(false);
  readonly showTemplates = signal(this.loadShowTemplatesPreference());
  readonly showTemplateGarments = signal(this.loadShowTemplateGarmentsPreference());

  // Pose state
  readonly posePresets = POSE_PRESETS;
  readonly selectedPoseId = signal<string>(this.outfitService.getSelectedPosePresetId());

  // Background prompt state (for AI-generated backgrounds)
  readonly backgroundPresets = BACKGROUND_PROMPT_PRESETS;
  readonly backgroundCategories = BACKGROUND_CATEGORIES;
  readonly aspectRatioOptions = ASPECT_RATIO_OPTIONS;
  readonly selectedPresetId = signal<string | null>(this.outfitService.getSelectedBackgroundPresetId());
  readonly customBackgroundPrompt = signal<string>(this.outfitService.getCustomBackgroundPrompt() ?? '');
  readonly selectedAspectRatio = signal<AspectRatioOption>(this.outfitService.getAspectRatio());
  readonly activeBackgroundCategory = signal<BackgroundCategory>(this.getInitialBackgroundCategory());
  readonly expandedCategory = signal<BackgroundCategory | null>(null);

  // ViewChild for scrolling to expanded background content on mobile
  @ViewChild('backgroundExpandedContent') backgroundExpandedContent?: ElementRef<HTMLElement>;
  @ViewChild('previewPanel') previewPanel?: ElementRef<HTMLElement>;

  // ViewChild references for tutorial auto-scroll
  @ViewChild('modelSection') modelSection?: ElementRef<HTMLElement>;
  @ViewChild('poseSection') poseSection?: ElementRef<HTMLElement>;
  @ViewChild('backgroundSection') backgroundSection?: ElementRef<HTMLElement>;
  @ViewChild('aspectRatioSection') aspectRatioSection?: ElementRef<HTMLElement>;
  @ViewChild('garmentsSection') garmentsSection?: ElementRef<HTMLElement>;

  constructor() {
    // Auto-scroll/switch to highlighted section during tutorial
    effect(() => {
      const step = this.tutorialStep();
      if (!step) return;

      // Map tutorial steps to mobile tabs
      const stepToTab: Record<string, 'model' | 'pose' | 'background' | 'ratio' | 'garments'> = {
        'model': 'model',
        'garment': 'garments',
        'models-full': 'model',
        'pose-full': 'pose',
        'background-full': 'background',
        'aspect-ratio-full': 'ratio',
        'garments-full': 'garments'
      };

      // Wait for DOM to update
      setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        if (isMobile) {
          // Switch to the appropriate tab on mobile
          const tab = stepToTab[step];
          if (tab) {
            this.mobileActiveSection.set(tab);
          }
        } else if (step.endsWith('-full')) {
          // Scroll to section on desktop (only for full walkthrough)
          this.scrollToTutorialSection(step);
        }
      }, 150);
    });
  }

  /**
   * Scroll to the section being highlighted in the tutorial walkthrough
   */
  private scrollToTutorialSection(step: string): void {
    let targetElement: ElementRef<HTMLElement> | undefined;

    switch (step) {
      case 'models-full':
        targetElement = this.modelSection;
        break;
      case 'pose-full':
        targetElement = this.poseSection;
        break;
      case 'background-full':
        targetElement = this.backgroundSection;
        break;
      case 'aspect-ratio-full':
        targetElement = this.aspectRatioSection;
        break;
      case 'garments-full':
        targetElement = this.garmentsSection;
        break;
    }

    if (targetElement?.nativeElement) {
      targetElement.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

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

  // Group garments by their group property (filtered by template visibility)
  get garmentsByGroup$() {
    return this.garments$.pipe(
      map(garments => {
        // Filter out templates if toggle is off
        const filteredGarments = this.showTemplateGarments()
          ? garments
          : garments.filter(g => !g.isTemplate);

        const groups: Record<GarmentGroup, Garment[]> = {
          'tops': [],
          'bottoms': [],
          'full-body': [],
          'jackets': [],
          'footwear': [],
          'accessories': []
        };
        filteredGarments.forEach(g => {
          const group = g.group;
          if (groups[group]) {
            groups[group].push(g);
          }
        });
        return groups;
      })
    );
  }

  // UI state
  readonly garmentGroups = GARMENT_GROUPS;

  // Generation state
  readonly isGenerating = signal(false);
  readonly generationProgress = signal<string | null>(null);

  // Archive state
  readonly isArchivePanelOpen = signal(false);

  // Mobile scene view state (#16) - collapsed after non-default selection
  readonly isMobilePoseCollapsed = signal(false);
  readonly isMobileBackgroundCollapsed = signal(false);

  // Selection history for recently deselected items (#24)
  readonly recentlyDeselectedModels = signal<SelectedInspiration[]>([]);
  private readonly MAX_RECENT_ITEMS = 5;

  // Computed: can generate?
  readonly canGenerate$ = combineLatest([
    this.selectedModels$,
    this.outfitService.hasCompleteGarmentSelection$
  ]).pipe(
    map(([models, hasGarments]) => models.length > 0 && hasGarments)
  );

  // Count selected garments
  readonly selectedGarmentCount$ = this.selectedGarments$.pipe(
    map(garments =>
      garments.top.length +
      garments.bottom.length +
      garments.fullBody.length +
      garments.jacket.length +
      garments.footwear.length +
      garments.accessories.length
    )
  );

  /**
   * Calculate credit cost for generation:
   * - Base try-on: 2 credits per model
   * - Pose change: +1 credit per model
   * - Background change: +1 credit per model
   * Total = (base + pose + background) * modelCount
   */
  get generationCreditCost(): number {
    let perModelCost = 2; // Base try-on cost
    if (this.selectedPoseId() !== 'original') {
      perModelCost += 1; // Pose change
    }
    if (this.hasBackgroundSelection()) {
      perModelCost += 1; // Background change
    }
    const modelCount = this.outfitService.getSelectedModels().length;
    return perModelCost * Math.max(modelCount, 1);
  }

  ngOnInit(): void {
    // Clear all selections when navigating to studio
    this.clearAllSelections();

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

    // Check for new signup and show welcome dialog
    this.checkNewUserWelcome();

    // Ensure advanced options are visible during full walkthrough
    if (this.isFullWalkthrough()) {
      this.showAdvancedOptions.set(true);
    }
  }

  /**
   * Clear all selections when entering the studio
   */
  private clearAllSelections(): void {
    // Clear model selection
    this.outfitService.clearModelSelection();

    // Clear garment selection
    this.outfitService.clearAllGarments();

    // Reset pose to original
    this.selectedPoseId.set('original');
    this.outfitService.setSelectedPosePresetId('original');

    // Clear background selection
    this.selectedPresetId.set(null);
    this.customBackgroundPrompt.set('');
    this.expandedCategory.set('original');
    this.activeBackgroundCategory.set('original');
    this.outfitService.setSelectedBackgroundPresetId(null);
    this.outfitService.setCustomBackgroundPrompt(null);

    // Reset aspect ratio to original
    this.selectedAspectRatio.set('original');
    this.outfitService.setAspectRatio('original');

    // Clear recently deselected models
    this.recentlyDeselectedModels.set([]);
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
      this.outfitService.setSelectedBackgroundPresetId(null);
      this.outfitService.setCustomBackgroundPrompt(null);
    } else {
      this.activeBackgroundCategory.set(category);

      // Scroll to the expanded content after it renders
      setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        this.backgroundExpandedContent?.nativeElement?.scrollIntoView({
          behavior: 'smooth',
          block: isMobile ? 'start' : 'nearest'
        });
      }, 100);
    }
  }

  selectPreset(preset: BackgroundPromptPreset): void {
    const currentId = this.selectedPresetId();
    if (currentId === preset.id) {
      // Deselect
      this.selectedPresetId.set(null);
      this.customBackgroundPrompt.set('');
      this.outfitService.setSelectedBackgroundPresetId(null);
      this.outfitService.setCustomBackgroundPrompt(null);
    } else {
      // Select and copy prompt to custom field for visibility
      this.selectedPresetId.set(preset.id);
      this.customBackgroundPrompt.set(preset.prompt);
      this.activeBackgroundCategory.set(preset.category);
      this.outfitService.setSelectedBackgroundPresetId(preset.id);
      this.outfitService.setCustomBackgroundPrompt(preset.prompt);
      // Collapse mobile background view after selection (#16)
      this.isMobileBackgroundCollapsed.set(true);
    }
  }

  // Expand mobile background selection (#16)
  expandMobileBackground(): void {
    this.isMobileBackgroundCollapsed.set(false);
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
    this.outfitService.setSelectedBackgroundPresetId(null);
    this.outfitService.setCustomBackgroundPrompt(null);
  }

  onCustomPromptChange(value: string): void {
    this.customBackgroundPrompt.set(value);
    this.outfitService.setCustomBackgroundPrompt(value || null);
    // Clear preset selection when user types custom prompt
    if (value && this.selectedPresetId()) {
      const selectedPreset = this.backgroundPresets.find(p => p.id === this.selectedPresetId());
      if (selectedPreset && value !== selectedPreset.prompt) {
        this.selectedPresetId.set(null);
        this.outfitService.setSelectedBackgroundPresetId(null);
      }
    }
  }

  selectAspectRatio(ratio: AspectRatioOption): void {
    this.selectedAspectRatio.set(ratio);
    this.outfitService.setAspectRatio(ratio);
  }

  clearAspectRatio(): void {
    this.selectedAspectRatio.set('original');
    this.outfitService.setAspectRatio('original');
  }

  // Pose selection methods
  selectPose(poseId: string): void {
    this.selectedPoseId.set(poseId);
    this.outfitService.setSelectedPosePresetId(poseId);
    // Collapse mobile pose view after non-default selection (#16)
    if (poseId !== 'original') {
      this.isMobilePoseCollapsed.set(true);
    }
  }

  // Expand mobile pose selection (#16)
  expandMobilePose(): void {
    this.isMobilePoseCollapsed.set(false);
  }

  isPoseSelected(poseId: string): boolean {
    return this.selectedPoseId() === poseId;
  }

  // Get icon for pose (#15)
  getPoseIcon(poseId: string): string {
    const iconMap: Record<string, string> = {
      'original': 'photo_camera',
      'hands-hips': 'accessibility_new',
      'arms-crossed': 'person',
      'power-stance': 'fitness_center',
      'one-hand-hip': 'accessibility',
      'casual-standing': 'person_outline',
      'leaning': 'airline_seat_recline_normal',
      'walking': 'directions_walk',
      'turning': '360',
      'stepping': 'directions_run',
      'model-pose': 'account_box',
      'looking-away': 'person_pin',
      'hand-on-chin': 'psychology'
    };
    return iconMap[poseId] || 'accessibility_new';
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

  private checkNewUserWelcome(): void {
    const isNewUser = localStorage.getItem('outfitify_new_user');
    if (isNewUser === 'true') {
      // Clear the flag immediately to prevent showing again
      localStorage.removeItem('outfitify_new_user');

      // Show welcome dialog with a slight delay to let the page load
      setTimeout(() => {
        this.dialog.open(WelcomeDialogComponent, {
          width: '420px',
          maxWidth: '95vw',
          disableClose: false,
          panelClass: 'welcome-dialog-panel'
        });
      }, 500);
    }
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
    let lastUploadedModel: SelectedInspiration | null = null;

    // Upload each file and track the last successful upload for auto-selection
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const previewUrl = reader.result as string;
        this.outfitService
          .uploadModelImage(file, previewUrl)
          .pipe(take(1))
          .subscribe({
            next: (uploadedModel) => {
              completedCount++;
              lastUploadedModel = uploadedModel;
              this.checkUploadCompletion(imageFiles.length, completedCount, errorCount, lastUploadedModel);
            },
            error: () => {
              errorCount++;
              completedCount++;
              this.checkUploadCompletion(imageFiles.length, completedCount, errorCount, lastUploadedModel);
            }
          });
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  private checkUploadCompletion(total: number, completed: number, errors: number, lastUploadedModel: SelectedInspiration | null): void {
    if (completed === total) {
      this.isUploadingModel.set(false);
      const successCount = total - errors;

      // Auto-select the last successfully uploaded model
      if (lastUploadedModel) {
        this.outfitService.toggleModelSelection(lastUploadedModel);
      }

      if (errors === 0) {
        this.snackBar.open(
          total === 1 ? 'Photo uploaded and selected!' : `${successCount} photos uploaded. Last one selected.`,
          'OK',
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
    // Check if model is currently selected (we're about to deselect it)
    const wasSelected = this.outfitService.isModelSelected(model.id);

    // Toggle selection for multi-model support
    const wasAdded = this.outfitService.toggleModelSelection(model);

    // Track deselected model in recent history (#24)
    if (wasSelected && !wasAdded) {
      this.addToRecentlyDeselected(model);
    }

    // Check if we're in the simplified tutorial 'model' step
    const isInModelTutorialStep = this.tutorialStep() === 'model';
    const isMobile = window.innerWidth < 1024;

    // Update tutorial state based on selection
    const selectedModels = this.outfitService.getSelectedModels();
    if (selectedModels.length > 0) {
      // If in model tutorial step and on mobile, delay the tutorial advance
      // to let user see the selection feedback before auto-navigating
      if (isInModelTutorialStep && isMobile && wasAdded) {
        setTimeout(() => {
          this.tutorialService.onModelSelected();
          // Auto-navigate to garments tab after tutorial advances
          setTimeout(() => {
            this.mobileActiveSection.set('garments');
          }, 100);
        }, 800);
      } else {
        this.tutorialService.onModelSelected();
      }
    } else {
      this.tutorialService.onModelDeselected();
    }

    // Show feedback when max limit is reached (model wasn't added AND wasn't already selected)
    if (!wasAdded && !wasSelected) {
      this.snackBar.open(
        'Maximum number of models reached',
        undefined,
        { duration: 2500 }
      );
    }

    // On mobile, scroll to preview panel when model is selected (skip if in tutorial - we'll navigate to garments instead)
    if (wasAdded && isMobile && !isInModelTutorialStep) {
      setTimeout(() => {
        this.previewPanel?.nativeElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }

  /**
   * Deselect a model from the preview panel (#26)
   */
  deselectModelFromPreview(model: SelectedInspiration, event?: Event): void {
    event?.stopPropagation();
    if (this.outfitService.isModelSelected(model.id)) {
      this.outfitService.toggleModelSelection(model);
      this.addToRecentlyDeselected(model);

      // Update tutorial state
      const selectedModels = this.outfitService.getSelectedModels();
      if (selectedModels.length === 0) {
        this.tutorialService.onModelDeselected();
      }
    }
  }

  /**
   * Add a model to the recently deselected list (#24)
   */
  private addToRecentlyDeselected(model: SelectedInspiration): void {
    const current = this.recentlyDeselectedModels();
    // Don't add if already in list
    if (current.some(m => m.id === model.id)) {
      return;
    }
    // Add to front of list, keep only MAX_RECENT_ITEMS
    const updated = [model, ...current].slice(0, this.MAX_RECENT_ITEMS);
    this.recentlyDeselectedModels.set(updated);
  }

  /**
   * Re-select a model from the recently deselected list (#24)
   */
  reselectModel(model: SelectedInspiration): void {
    // Remove from recently deselected
    const current = this.recentlyDeselectedModels();
    this.recentlyDeselectedModels.set(current.filter(m => m.id !== model.id));
    // Re-select the model
    this.outfitService.toggleModelSelection(model);
  }

  /**
   * Clear the recently deselected list (#24)
   */
  clearRecentlyDeselected(): void {
    this.recentlyDeselectedModels.set([]);
  }

  isModelSelected(model: SelectedInspiration): boolean {
    return this.outfitService.isModelSelected(model.id);
  }

  getModelSelectionBadge(model: SelectedInspiration): string | undefined {
    const models = this.outfitService.getSelectedModels();
    const index = models.findIndex(m => m.id === model.id);
    if (index >= 0) {
      return `${index + 1}`;
    }
    return undefined;
  }

  clearModelSelection(): void {
    this.outfitService.clearModelSelection();
    this.tutorialService.onModelDeselected();
  }

  setPreviewModel(model: SelectedInspiration): void {
    this.outfitService.setPreviewModel(model);
  }

  isPreviewModel(model: SelectedInspiration): boolean {
    const currentPreview = this.outfitService.getPreviewModel();
    return currentPreview?.id === model.id;
  }

  // Garment methods - use toggleSelectedGarment for multi-selection support
  // Limits: 2 tops, 2 bottoms, 1 full-body, 2 jackets, 3 accessories
  toggleGarment(garment: Garment): void {
    this.outfitService.toggleSelectedGarment(garment.group, garment);
  }

  isGarmentSelected(garment: Garment): boolean {
    return this.outfitService.isGarmentSelected(garment.group, garment.id);
  }

  clearAllGarments(): void {
    this.outfitService.clearAllGarments();
    this.snackBar.open('All garments cleared', undefined, { duration: 2000 });
  }

  clearGarmentCategory(event: Event, group: GarmentGroup): void {
    event.stopPropagation();
    this.outfitService.clearGarmentCategory(group);
  }

  // Generation
  generateOutfit(): void {
    // Check if user has enough credits for all selected models
    const totalCost = this.generationCreditCost;
    const currentBalance = this.creditsService.balance;

    if (currentBalance !== null && currentBalance < totalCost) {
      this.snackBar.open(
        `Insufficient credits. You need ${totalCost} credits but only have ${currentBalance}.`,
        'Get Credits',
        { duration: 5000 }
      ).onAction().subscribe(() => {
        this.router.navigate(['/billing']);
      });
      return;
    }

    this.isGenerating.set(true);

    const modelCount = this.outfitService.getSelectedModels().length;
    this.generationProgress.set(`Preparing ${modelCount > 1 ? modelCount + ' outfits' : 'your outfit'}...`);

    // Set pose, background prompt, and aspect ratio in the service before creating outfit
    const posePrompt = this.getSelectedPosePrompt();
    const backgroundPrompt = this.customBackgroundPrompt().trim() || null;
    const aspectRatio = this.selectedAspectRatio();

    // Set the pose, prompt and aspect ratio in the outfit service
    this.outfitService.setPosePrompt(posePrompt);
    this.outfitService.setCustomBackgroundPrompt(backgroundPrompt);
    this.outfitService.setAspectRatio(aspectRatio);

    this.outfitService.createOutfits().pipe(take(1)).subscribe({
      next: (result) => {
        const { succeeded, failed } = result;

        setTimeout(() => {
          this.isGenerating.set(false);
          this.generationProgress.set(null);

          if (failed.length === 0) {
            this.snackBar.open(
              `${succeeded.length} outfit${succeeded.length > 1 ? 's' : ''} generation started!`,
              'Nice!',
              { duration: 3500 }
            );
          } else if (succeeded.length > 0) {
            this.snackBar.open(
              `${succeeded.length} started, ${failed.length} failed`,
              'View',
              { duration: 5000 }
            );
          } else {
            this.snackBar.open('All generations failed. Please try again.', 'Dismiss', {
              duration: 4000
            });
          }

          if (succeeded.length > 0) {
            // Mark first outfit created for tutorial completion
            this.tutorialService.markFirstOutfitCreated();
            this.showAdvancedOptions.set(true);
            this.router.navigate(['/generated-gallery']);
          }
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
      width: '700px',
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

  // Template garment visibility toggle methods
  toggleShowTemplateGarments(): void {
    const newValue = !this.showTemplateGarments();
    this.showTemplateGarments.set(newValue);
    this.saveShowTemplateGarmentsPreference(newValue);
  }

  private loadShowTemplateGarmentsPreference(): boolean {
    const stored = localStorage.getItem('studio.showTemplateGarments');
    return stored === null ? true : stored === 'true';
  }

  private saveShowTemplateGarmentsPreference(value: boolean): void {
    localStorage.setItem('studio.showTemplateGarments', String(value));
  }

  private getInitialBackgroundCategory(): BackgroundCategory {
    const presetId = this.outfitService.getSelectedBackgroundPresetId();
    if (presetId) {
      const preset = this.backgroundPresets.find(p => p.id === presetId);
      if (preset) {
        return preset.category;
      }
    }
    return 'original';
  }

  // Toggle advanced options visibility (for tutorial mode)
  toggleAdvancedOptions(): void {
    this.showAdvancedOptions.set(!this.showAdvancedOptions());
  }

  // Expand advanced options (user wants to see them)
  expandAdvancedOptions(): void {
    this.showAdvancedOptions.set(true);
  }
}
