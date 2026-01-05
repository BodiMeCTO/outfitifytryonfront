import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  computed,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface GenerationStep {
  id: string;
  label: string;
  icon: string;
}

export type StepStatus = 'pending' | 'active' | 'completed';

const DEFAULT_STEPS: GenerationStep[] = [
  { id: 'prepare', label: 'Preparing your images', icon: 'image' },
  { id: 'analyze', label: 'Analyzing outfit combination', icon: 'psychology' },
  { id: 'generate', label: 'Generating your look', icon: 'auto_awesome' },
  { id: 'finalize', label: 'Finalizing result', icon: 'check_circle' }
];

@Component({
  standalone: true,
  selector: 'app-generation-progress',
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="progress-container" [class.is-visible]="isVisible">
      <div class="progress-backdrop"></div>
      <div class="progress-card">
        <!-- Animated logo/icon -->
        <div class="progress-hero">
          <div class="spinner-wrapper">
            <svg class="progress-ring" viewBox="0 0 100 100">
              <circle class="ring-bg" cx="50" cy="50" r="45"></circle>
              <circle class="ring-progress" cx="50" cy="50" r="45"></circle>
            </svg>
            <mat-icon class="hero-icon">{{ currentStepIcon() }}</mat-icon>
          </div>
        </div>

        <!-- Current step label -->
        <h3 class="progress-title">{{ currentStepLabel() }}</h3>

        <!-- Step indicators -->
        <div class="step-indicators">
          @for (step of steps; track step.id; let i = $index) {
            <div
              class="step-indicator"
              [class.is-pending]="getStepStatus(i) === 'pending'"
              [class.is-active]="getStepStatus(i) === 'active'"
              [class.is-completed]="getStepStatus(i) === 'completed'"
            >
              <span class="step-dot">
                @if (getStepStatus(i) === 'completed') {
                  <mat-icon>check</mat-icon>
                } @else if (getStepStatus(i) === 'active') {
                  <span class="pulse-dot"></span>
                }
              </span>
            </div>
            @if (i < steps.length - 1) {
              <div
                class="step-connector"
                [class.is-completed]="getStepStatus(i) === 'completed'"
              ></div>
            }
          }
        </div>

        <!-- Estimated time -->
        <p class="progress-hint">
          <mat-icon>schedule</mat-icon>
          Usually takes 15-30 seconds
        </p>
      </div>
    </div>
  `,
  styles: [`
    @use '../../../../styles/tokens' as *;

    .progress-container {
      position: fixed;
      inset: 0;
      z-index: $z-modal;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: $space-4;
      opacity: 0;
      visibility: hidden;
      transition: opacity $transition-base, visibility $transition-base;

      &.is-visible {
        opacity: 1;
        visibility: visible;
      }
    }

    .progress-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
    }

    .progress-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: $space-6;
      padding: $space-8;
      max-width: 360px;
      width: 100%;
      text-align: center;
      animation: slideUp 0.4s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .progress-hero {
      position: relative;
      width: 100px;
      height: 100px;
    }

    .spinner-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .progress-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);

      circle {
        fill: none;
        stroke-width: 3;
        stroke-linecap: round;
      }

      .ring-bg {
        stroke: $color-bg-tertiary;
      }

      .ring-progress {
        stroke: $color-accent-gold;
        stroke-dasharray: 283;
        stroke-dashoffset: 70;
        animation: spin 2s linear infinite, pulse-ring 1.5s ease-in-out infinite;
      }
    }

    @keyframes spin {
      from { transform: rotate(-90deg); }
      to { transform: rotate(270deg); }
    }

    @keyframes pulse-ring {
      0%, 100% { stroke-dashoffset: 100; }
      50% { stroke-dashoffset: 50; }
    }

    .hero-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: $color-accent-gold;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .progress-title {
      font-size: $font-size-lg;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
      margin: 0;
      min-height: 1.5em;
    }

    .step-indicators {
      display: flex;
      align-items: center;
      gap: 0;
      margin: $space-2 0;
    }

    .step-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    .step-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: $color-bg-tertiary;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all $transition-fast;

      mat-icon {
        font-size: 10px;
        width: 10px;
        height: 10px;
        color: $color-text-inverse;
      }
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: $color-accent-gold;
      animation: pulse-dot 1s ease-in-out infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.7; }
    }

    .step-indicator.is-active .step-dot {
      width: 16px;
      height: 16px;
      background: $color-accent-gold-light;
      border: 2px solid $color-accent-gold;
    }

    .step-indicator.is-completed .step-dot {
      background: $color-accent-gold;
    }

    .step-connector {
      width: 24px;
      height: 2px;
      background: $color-bg-tertiary;
      transition: background $transition-fast;

      &.is-completed {
        background: $color-accent-gold;
      }
    }

    .progress-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $space-2;
      margin: 0;
      font-size: $font-size-sm;
      color: $color-text-muted;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenerationProgressComponent implements OnInit, OnDestroy {
  @Input() isVisible = false;
  @Input() steps: GenerationStep[] = DEFAULT_STEPS;

  private currentStepIndex = signal(0);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly currentStepLabel = computed(() => {
    const step = this.steps[this.currentStepIndex()];
    return step?.label || 'Processing...';
  });

  readonly currentStepIcon = computed(() => {
    const step = this.steps[this.currentStepIndex()];
    return step?.icon || 'hourglass_empty';
  });

  ngOnInit(): void {
    // Auto-advance steps for visual feedback
    this.intervalId = setInterval(() => {
      const nextIndex = this.currentStepIndex() + 1;
      if (nextIndex < this.steps.length) {
        this.currentStepIndex.set(nextIndex);
      } else {
        // Reset to loop or stay at last step
        this.currentStepIndex.set(this.steps.length - 1);
      }
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  getStepStatus(index: number): StepStatus {
    const current = this.currentStepIndex();
    if (index < current) return 'completed';
    if (index === current) return 'active';
    return 'pending';
  }

  reset(): void {
    this.currentStepIndex.set(0);
  }
}
