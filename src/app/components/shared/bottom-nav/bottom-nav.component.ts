import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

export interface BottomNavItem {
  label: string;
  icon: string;
  activeIcon?: string;
  route: string;
  badge?: number | string;
}

@Component({
  standalone: true,
  selector: 'app-bottom-nav',
  imports: [CommonModule, RouterModule, MatIconModule, MatRippleModule],
  template: `
    <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
      @for (item of items; track item.label) {
        <a
          [routerLink]="item.route"
          routerLinkActive="is-active"
          #rla="routerLinkActive"
          class="nav-item"
          matRipple
          [matRippleCentered]="true"
          [attr.aria-current]="rla.isActive ? 'page' : null"
        >
          <span class="icon-wrapper">
            <mat-icon class="nav-icon">
              {{ rla.isActive && item.activeIcon ? item.activeIcon : item.icon }}
            </mat-icon>
            @if (item.badge) {
              <span class="badge" [attr.aria-label]="item.badge + ' notifications'">
                {{ item.badge }}
              </span>
            }
          </span>
          <span class="nav-label">{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: [`
    @use '../../../../styles/tokens' as *;

    :host {
      display: block;

      @include lg {
        display: none; // Hide on desktop
      }
    }

    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: $z-fixed;
      display: flex;
      align-items: stretch;
      justify-content: space-around;
      height: $bottom-nav-height;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      background: $bottom-nav-bg;
      border-top: 1px solid $color-border;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: $space-1;
      flex: 1;
      min-width: $touch-target-min;
      min-height: $touch-target-min;
      padding: $space-2 $space-3;
      text-decoration: none;
      color: $color-text-muted;
      transition: color $transition-fast;
      position: relative;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        color: $color-text-secondary;
      }

      &.is-active {
        color: $color-accent-gold-dark;

        .nav-icon {
          transform: scale(1.1);
        }

        .nav-label {
          font-weight: $font-weight-semibold;
        }

        // Active indicator bar
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 32px;
          height: 3px;
          background: $color-accent-gold;
          border-radius: 0 0 $radius-sm $radius-sm;
        }
      }

      @include focus-ring;
    }

    .icon-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nav-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      transition: transform $transition-fast;
    }

    .nav-label {
      font-size: $font-size-xs;
      font-weight: $font-weight-medium;
      letter-spacing: $letter-spacing-wide;
      line-height: 1;
      text-transform: uppercase;
    }

    .badge {
      position: absolute;
      top: -4px;
      right: -8px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-size: 10px;
      font-weight: $font-weight-semibold;
      line-height: 16px;
      text-align: center;
      color: $color-text-inverse;
      background: $color-accent-gold;
      border-radius: $radius-full;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BottomNavComponent {
  @Input() items: BottomNavItem[] = [];
}
