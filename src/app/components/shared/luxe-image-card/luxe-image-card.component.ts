import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type ImageCardAspectRatio = '3:4' | '4:3' | '1:1' | '16:9' | 'auto';

@Component({
  standalone: true,
  selector: 'app-luxe-image-card',
  imports: [CommonModule, MatIconModule],
  template: `
    <button
      type="button"
      class="image-card"
      [class.is-selected]="selected"
      [class.is-loading]="isLoading()"
      [class.is-disabled]="disabled"
      [style.aspect-ratio]="aspectRatioValue"
      (click)="handleClick($event)"
    >
      <!-- Loading skeleton - show while loading but hide once image is loaded -->
      <div class="skeleton" *ngIf="isLoading() && !imageLoaded()"></div>

      <!-- Image - always render if src exists so onload/onerror can fire -->
      <img
        *ngIf="src"
        [src]="src"
        [alt]="alt"
        (load)="onImageLoad()"
        (error)="onImageError()"
        [class.loaded]="imageLoaded()"
      />

      <!-- Placeholder when no image -->
      <div class="placeholder" *ngIf="!src && !isLoading()">
        <mat-icon>{{ placeholderIcon }}</mat-icon>
        <span *ngIf="placeholderText" class="placeholder-text">{{ placeholderText }}</span>
      </div>

      <!-- Badge overlay -->
      <span class="badge" *ngIf="badge" [class]="'badge-' + badgeVariant">
        <mat-icon *ngIf="badgeIcon" class="badge-icon">{{ badgeIcon }}</mat-icon>
        {{ badge }}
      </span>

      <!-- Selection indicator -->
      <div class="selection-ring" *ngIf="selected"></div>

      <!-- Hover overlay -->
      <div class="hover-overlay" *ngIf="showHoverOverlay">
        <mat-icon>{{ hoverIcon }}</mat-icon>
      </div>
    </button>
  `,
  styles: [`
    @use '../../../../styles/tokens' as *;

    :host {
      display: block;
    }

    .image-card {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 0;
      margin: 0;
      border: 1px solid $color-border;
      border-radius: $image-card-radius;
      background: $color-bg-tertiary;
      overflow: hidden;
      cursor: pointer;
      transition: all $transition-fast;
      -webkit-tap-highlight-color: transparent;

      &:hover:not(.is-disabled) {
        border-color: $color-border-strong;
        transform: translateY(-2px);
        box-shadow: $shadow-lift;

        .hover-overlay {
          opacity: 1;
        }
      }

      &:active:not(.is-disabled) {
        transform: scale(0.98);
      }

      &:focus-visible {
        outline: 2px solid $color-accent-gold;
        outline-offset: 2px;
      }

      &.is-disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      &.is-selected {
        border-color: $color-accent-gold;
        box-shadow: 0 0 0 3px $color-accent-gold, 0 4px 12px rgba(201, 169, 110, 0.25);
        background: $color-accent-gold-light;
        animation: selectBounce 350ms ease-out;
      }
    }

    @keyframes selectBounce {
      0% { transform: scale(1); }
      30% { transform: scale(0.95); }
      50% { transform: scale(1.02); }
      70% { transform: scale(0.99); }
      100% { transform: scale(1); }
    }

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      opacity: 0;
      transition: opacity $transition-base;

      &.loaded {
        opacity: 1;
      }
    }

    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: $space-2;
      padding: $space-4;
      color: $color-text-muted;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        opacity: 0.5;
      }
    }

    .placeholder-text {
      font-size: $font-size-xs;
      font-weight: $font-weight-medium;
      text-transform: uppercase;
      letter-spacing: $letter-spacing-wide;
      text-align: center;
    }

    .skeleton {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        $color-bg-tertiary 0%,
        $color-bg-secondary 50%,
        $color-bg-tertiary 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .badge {
      position: absolute;
      top: $space-2;
      left: $space-2;
      display: inline-flex;
      align-items: center;
      gap: $space-1;
      padding: $space-1 $space-2;
      font-size: $font-size-xs;
      font-weight: $font-weight-medium;
      letter-spacing: $letter-spacing-wide;
      text-transform: uppercase;
      border-radius: $radius-sm;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      backdrop-filter: blur(4px);
    }

    .badge-gold {
      background: $color-accent-gold;
      color: $color-text-primary;
    }

    .badge-rose {
      background: $color-accent-rose;
      color: $color-text-primary;
    }

    .badge-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .selection-ring {
      position: absolute;
      inset: -3px;
      border: 3px solid $color-accent-gold;
      border-radius: calc($image-card-radius + 3px);
      pointer-events: none;
    }

    .hover-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.4);
      opacity: 0;
      transition: opacity $transition-fast;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: white;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LuxeImageCardComponent {
  @Input() src?: string;
  @Input() alt = 'Image';
  @Input() aspectRatio: ImageCardAspectRatio = '3:4';
  @Input() selected = false;
  @Input() disabled = false;
  @Input() loading = false;
  @Input() badge?: string;
  @Input() badgeIcon?: string;
  @Input() badgeVariant: 'default' | 'gold' | 'rose' = 'default';
  @Input() placeholderIcon = 'image';
  @Input() placeholderText?: string;
  @Input() showHoverOverlay = false;
  @Input() hoverIcon = 'check_circle';

  @Output() cardClick = new EventEmitter<MouseEvent>();

  readonly isLoading = signal(false);
  readonly imageLoaded = signal(false);
  private previousSrc?: string;

  get aspectRatioValue(): string {
    if (this.aspectRatio === 'auto') return 'auto';
    return this.aspectRatio.replace(':', ' / ');
  }

  ngOnInit(): void {
    if (this.loading || (this.src && !this.imageLoaded())) {
      this.isLoading.set(true);
    }
    this.previousSrc = this.src;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only reset loading state if src actually changed
    if (changes['src'] && this.src !== this.previousSrc) {
      this.previousSrc = this.src;
      if (this.src) {
        this.imageLoaded.set(false);
        this.isLoading.set(true);
      }
    }
  }

  onImageLoad(): void {
    this.imageLoaded.set(true);
    this.isLoading.set(false);
  }

  onImageError(): void {
    this.imageLoaded.set(false);
    this.isLoading.set(false);
  }

  handleClick(event: MouseEvent): void {
    if (!this.disabled) {
      this.cardClick.emit(event);
    }
  }
}
