import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  HostBinding
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type LuxeButtonVariant = 'primary' | 'secondary' | 'ghost' | 'text';
export type LuxeButtonSize = 'sm' | 'md' | 'lg';

@Component({
  standalone: true,
  selector: 'app-luxe-button',
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <button
      [type]="type"
      [class]="buttonClasses"
      [disabled]="disabled || loading"
      (click)="handleClick($event)"
    >
      <mat-spinner
        *ngIf="loading"
        [diameter]="spinnerSize"
        class="spinner"
      ></mat-spinner>
      <mat-icon *ngIf="icon && !loading" class="icon">{{ icon }}</mat-icon>
      <span class="label" *ngIf="!iconOnly">
        <ng-content></ng-content>
      </span>
      <mat-icon *ngIf="iconRight && !loading" class="icon-right">{{ iconRight }}</mat-icon>
    </button>
  `,
  styles: [`
    @use '../../../../styles/tokens' as *;

    :host {
      display: inline-flex;
    }

    :host(.full-width) {
      display: flex;
      width: 100%;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: $space-2;
      border: none;
      cursor: pointer;
      font-family: $font-family-primary;
      font-weight: $font-weight-medium;
      letter-spacing: $letter-spacing-wide;
      text-transform: uppercase;
      transition: all $transition-fast;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      @include focus-ring;
    }

    // Sizes
    .size-sm {
      height: $button-height-sm;
      padding: 0 $space-4;
      font-size: $font-size-xs;
      border-radius: $radius-full;
    }

    .size-md {
      height: $button-height-md;
      padding: 0 $button-padding-x;
      font-size: $font-size-sm;
      border-radius: $radius-full;
    }

    .size-lg {
      height: $button-height-lg;
      padding: 0 $space-8;
      font-size: $font-size-base;
      border-radius: $radius-full;
    }

    // Primary variant (gold filled)
    .variant-primary {
      background: $color-accent-gold;
      color: $color-text-primary;

      &:hover:not(:disabled) {
        background: $color-accent-gold-hover;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(201, 169, 110, 0.35);
      }

      &:active:not(:disabled) {
        transform: scale(0.98) translateY(0);
        box-shadow: none;
      }
    }

    // Secondary variant (gold outline)
    .variant-secondary {
      background: transparent;
      color: $color-accent-gold-dark; // Accessible gold for text
      border: 1.5px solid $color-accent-gold;

      &:hover:not(:disabled) {
        background: $color-accent-gold-light;
        color: $color-accent-gold-dark;
      }
    }

    // Ghost variant (subtle background on hover)
    .variant-ghost {
      background: transparent;
      color: $color-text-secondary;

      &:hover:not(:disabled) {
        background: $color-bg-tertiary;
        color: $color-text-primary;
      }
    }

    // Text variant (no background)
    .variant-text {
      background: transparent;
      color: $color-accent-gold-dark; // Accessible gold for text
      padding: 0 $space-2;

      &:hover:not(:disabled) {
        color: $color-accent-gold-hover;
      }
    }

    // Full width
    .full-width {
      width: 100%;
    }

    // Icon only
    .icon-only {
      padding: 0;
      aspect-ratio: 1;

      &.size-sm { width: $button-height-sm; }
      &.size-md { width: $button-height-md; }
      &.size-lg { width: $button-height-lg; }
    }

    .icon, .icon-right {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .size-sm .icon,
    .size-sm .icon-right {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .size-lg .icon,
    .size-lg .icon-right {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .spinner {
      ::ng-deep circle {
        stroke: currentColor;
      }
    }

    .label {
      display: flex;
      align-items: center;
      line-height: 1;
    }

    // Ensure icons are vertically centered
    .icon, .icon-right {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LuxeButtonComponent {
  @Input() variant: LuxeButtonVariant = 'primary';
  @Input() size: LuxeButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;
  @Input() icon?: string;
  @Input() iconRight?: string;
  @Input() iconOnly = false;

  @Output() clicked = new EventEmitter<MouseEvent>();

  @HostBinding('class.full-width') get hostFullWidth() { return this.fullWidth; }

  get buttonClasses(): string {
    return [
      `variant-${this.variant}`,
      `size-${this.size}`,
      this.fullWidth ? 'full-width' : '',
      this.iconOnly ? 'icon-only' : ''
    ].filter(Boolean).join(' ');
  }

  get spinnerSize(): number {
    switch (this.size) {
      case 'sm': return 16;
      case 'lg': return 24;
      default: return 20;
    }
  }

  handleClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
