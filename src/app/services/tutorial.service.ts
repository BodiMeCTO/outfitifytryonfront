import { Injectable, signal, computed, inject } from '@angular/core';
import { take, filter } from 'rxjs/operators';
import { OutfitifyApiService } from './outfitify-api.service';
import { AuthService } from './auth.service';

// Tutorial steps flow:
// 1. 'model' - First visit: pick a model (simplified)
// 2. 'garment' - After model selected: pick garments (simplified)
// 3. 'gallery-return' - After first generation: on gallery, prompt to return to studio
// 4. 'models-full' - Back in studio: explain model upload feature
// 5. 'pose-full' - Explain pose options
// 6. 'background-full' - Explain background options
// 7. 'aspect-ratio-full' - Explain aspect ratio options
// 8. 'garments-full' - Explain garment upload feature
// 9. 'complete' - Tutorial done
export type TutorialStep =
  | 'model'
  | 'garment'
  | 'gallery-return'
  | 'models-full'
  | 'pose-full'
  | 'background-full'
  | 'aspect-ratio-full'
  | 'garments-full'
  | 'complete';

// Steps that are part of the full walkthrough (shown after first outfit)
const FULL_WALKTHROUGH_STEPS: TutorialStep[] = [
  'models-full',
  'pose-full',
  'background-full',
  'aspect-ratio-full',
  'garments-full'
];

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly apiService = inject(OutfitifyApiService);
  private readonly authService = inject(AuthService);

  private readonly STORAGE_KEY = 'outfitify_tutorial_completed';
  private readonly FIRST_OUTFIT_KEY = 'outfitify_has_created_outfit';

  // Tutorial step signal for reactive updates
  private readonly _tutorialStep = signal<TutorialStep>(this.getInitialStep());

  // Track if we've loaded from server
  private serverStateLoaded = false;

  // Public readonly signals
  readonly tutorialStep = this._tutorialStep.asReadonly();

  // Tutorial is active if not complete
  readonly isTutorialActive = computed(() => this._tutorialStep() !== 'complete');

  // Check if we're in the simplified first-time flow (model/garment steps)
  readonly isSimplifiedFlow = computed(() => {
    const step = this._tutorialStep();
    return step === 'model' || step === 'garment';
  });

  // Check if we're in the full walkthrough (after first outfit)
  readonly isFullWalkthrough = computed(() => {
    const step = this._tutorialStep();
    return FULL_WALKTHROUGH_STEPS.includes(step);
  });

  // Check if we're on the gallery return step
  readonly isGalleryReturnStep = computed(() => this._tutorialStep() === 'gallery-return');

  constructor() {
    // Load from server when user logs in
    this.authService.token$.pipe(
      filter(token => !!token)
    ).subscribe(() => {
      this.loadFromServer();
    });

    // Reset to initial state when user logs out
    this.authService.token$.pipe(
      filter(token => !token)
    ).subscribe(() => {
      this.serverStateLoaded = false;
      // Reset to localStorage state (or default) on logout
      this._tutorialStep.set(this.getInitialStep());
    });
  }

  private getInitialStep(): TutorialStep {
    // Check if tutorial is fully completed
    if (localStorage.getItem(this.STORAGE_KEY) === 'true') {
      return 'complete';
    }
    // Check if first outfit was created (show gallery return or continue walkthrough)
    if (localStorage.getItem(this.FIRST_OUTFIT_KEY) === 'true') {
      // Check where they left off in the walkthrough
      const savedStep = localStorage.getItem('outfitify_tutorial_step');
      if (savedStep && FULL_WALKTHROUGH_STEPS.includes(savedStep as TutorialStep)) {
        return savedStep as TutorialStep;
      }
      return 'gallery-return';
    }
    return 'model';
  }

  private loadFromServer(): void {
    this.apiService.getTutorialState().pipe(take(1)).subscribe({
      next: (state) => {
        this.serverStateLoaded = true;

        // Update localStorage cache
        if (state.tutorialCompleted) {
          localStorage.setItem(this.STORAGE_KEY, 'true');
        } else {
          localStorage.removeItem(this.STORAGE_KEY);
        }

        if (state.hasCreatedFirstOutfit) {
          localStorage.setItem(this.FIRST_OUTFIT_KEY, 'true');
        } else {
          localStorage.removeItem(this.FIRST_OUTFIT_KEY);
        }

        if (state.tutorialStep) {
          localStorage.setItem('outfitify_tutorial_step', state.tutorialStep);
        } else {
          localStorage.removeItem('outfitify_tutorial_step');
        }

        // Determine the correct step based on server state
        let step: TutorialStep;
        if (state.tutorialCompleted) {
          step = 'complete';
        } else if (state.tutorialStep && this.isValidStep(state.tutorialStep)) {
          step = state.tutorialStep as TutorialStep;
        } else if (state.hasCreatedFirstOutfit) {
          step = 'gallery-return';
        } else {
          step = 'model';
        }

        this._tutorialStep.set(step);
      },
      error: (err) => {
        console.error('Failed to load tutorial state from server:', err);
        // Keep using localStorage state
      }
    });
  }

  private isValidStep(step: string): boolean {
    const validSteps: TutorialStep[] = [
      'model', 'garment', 'gallery-return',
      'models-full', 'pose-full', 'background-full',
      'aspect-ratio-full', 'garments-full', 'complete'
    ];
    return validSteps.includes(step as TutorialStep);
  }

  private saveToServer(): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    const step = this._tutorialStep();
    const tutorialCompleted = step === 'complete';
    const hasCreatedFirstOutfit = localStorage.getItem(this.FIRST_OUTFIT_KEY) === 'true';

    this.apiService.updateTutorialState({
      tutorialCompleted,
      tutorialStep: step !== 'complete' && step !== 'model' && step !== 'garment' ? step : null,
      hasCreatedFirstOutfit
    }).pipe(take(1)).subscribe({
      error: (err) => console.error('Failed to save tutorial state to server:', err)
    });
  }

  isTutorialCompleted(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  markTutorialCompleted(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    localStorage.removeItem('outfitify_tutorial_step');
    this._tutorialStep.set('complete');
    this.saveToServer();
  }

  resetTutorial(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.FIRST_OUTFIT_KEY);
    localStorage.removeItem('outfitify_tutorial_step');
    this._tutorialStep.set('model');
    this.saveToServer();
  }

  // Check if user has ever created an outfit
  hasCreatedFirstOutfit(): boolean {
    return localStorage.getItem(this.FIRST_OUTFIT_KEY) === 'true';
  }

  // Mark that user has created their first outfit - moves to gallery-return step
  markFirstOutfitCreated(): void {
    localStorage.setItem(this.FIRST_OUTFIT_KEY, 'true');
    this._tutorialStep.set('gallery-return');
    this.saveToServer();
  }

  // Get current tutorial step
  getCurrentStep(): TutorialStep {
    return this._tutorialStep();
  }

  // Advance to a specific step
  advanceToStep(step: TutorialStep): void {
    this._tutorialStep.set(step);
    // Persist walkthrough progress
    if (FULL_WALKTHROUGH_STEPS.includes(step)) {
      localStorage.setItem('outfitify_tutorial_step', step);
    }
    this.saveToServer();
  }

  // Called when user selects a model (simplified flow)
  onModelSelected(): void {
    if (this._tutorialStep() === 'model') {
      this._tutorialStep.set('garment');
    }
  }

  // Called when user deselects all models (simplified flow)
  onModelDeselected(): void {
    if (this._tutorialStep() === 'garment') {
      this._tutorialStep.set('model');
    }
  }

  // Called when returning to studio from gallery (starts full walkthrough)
  startFullWalkthrough(): void {
    if (this._tutorialStep() === 'gallery-return') {
      this._tutorialStep.set('models-full');
      localStorage.setItem('outfitify_tutorial_step', 'models-full');
      this.saveToServer();
    }
  }

  // Advance to next step in the full walkthrough
  nextWalkthroughStep(): void {
    const currentStep = this._tutorialStep();
    const currentIndex = FULL_WALKTHROUGH_STEPS.indexOf(currentStep);

    if (currentIndex >= 0 && currentIndex < FULL_WALKTHROUGH_STEPS.length - 1) {
      const nextStep = FULL_WALKTHROUGH_STEPS[currentIndex + 1];
      this._tutorialStep.set(nextStep);
      localStorage.setItem('outfitify_tutorial_step', nextStep);
      this.saveToServer();
    } else if (currentIndex === FULL_WALKTHROUGH_STEPS.length - 1) {
      // Last step - complete the tutorial
      this.markTutorialCompleted();
    }
  }

  // Skip the full walkthrough and mark complete
  skipWalkthrough(): void {
    this.markTutorialCompleted();
  }

  // Get the step number for display (1-5 for walkthrough)
  getWalkthroughStepNumber(): number {
    const currentStep = this._tutorialStep();
    const index = FULL_WALKTHROUGH_STEPS.indexOf(currentStep);
    return index >= 0 ? index + 1 : 0;
  }

  // Get total walkthrough steps
  getTotalWalkthroughSteps(): number {
    return FULL_WALKTHROUGH_STEPS.length;
  }
}
