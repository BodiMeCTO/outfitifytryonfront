import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LuxeButtonComponent } from '../shared/luxe-button/luxe-button.component';
import { TutorialService } from '../../services/tutorial.service';

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  actionLabel: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    title: 'Upload Your Photo',
    description: 'Start by uploading a photo of yourself. This will be your model for trying on clothes.',
    icon: 'add_photo_alternate',
    actionLabel: 'Next'
  },
  {
    id: 2,
    title: 'Change the Background',
    description: 'Optionally, you can change your photo\'s background to match your style or brand.',
    icon: 'photo_library',
    actionLabel: 'Next'
  },
  {
    id: 3,
    title: 'Add Your Garments',
    description: 'Upload garment images to build your wardrobe. Then mix and match to create outfits!',
    icon: 'checkroom',
    actionLabel: 'Get Started'
  }
];

@Component({
  selector: 'app-onboarding-tutorial',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    LuxeButtonComponent
  ],
  templateUrl: './onboarding-tutorial.component.html',
  styleUrl: './onboarding-tutorial.component.scss'
})
export class OnboardingTutorialComponent {
  private readonly dialogRef = inject(MatDialogRef<OnboardingTutorialComponent>);
  private readonly tutorialService = inject(TutorialService);

  readonly steps = TUTORIAL_STEPS;
  readonly currentStep = signal(1);

  get currentStepData(): TutorialStep | undefined {
    return this.steps.find(s => s.id === this.currentStep());
  }

  nextStep(): void {
    if (this.currentStep() < this.steps.length) {
      this.currentStep.update(s => s + 1);
    } else {
      this.completeTutorial();
    }
  }

  skipTutorial(): void {
    this.completeTutorial();
  }

  private completeTutorial(): void {
    this.tutorialService.markTutorialCompleted();
    this.dialogRef.close();
  }
}
