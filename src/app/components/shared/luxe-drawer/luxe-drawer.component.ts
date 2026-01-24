import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface DrawerNavItem {
  label: string;
  route: string;
  icon: string;
  badge?: string;
}

@Component({
  standalone: true,
  selector: 'app-luxe-drawer',
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Backdrop -->
    <div
      class="drawer-backdrop"
      [class.is-open]="isOpen"
      (click)="close()"
    ></div>

    <!-- Drawer panel -->
    <aside
      class="drawer-panel"
      [class.is-open]="isOpen"
      role="navigation"
      aria-label="Main navigation"
    >
      <!-- Header -->
      <div class="drawer-header">
        <span class="brand">OUTFITIFY</span>
        <button
          mat-icon-button
          class="close-button"
          (click)="close()"
          aria-label="Close menu"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Navigation items -->
      <nav class="drawer-nav">
        <a
          *ngFor="let item of navItems"
          [routerLink]="item.route"
          routerLinkActive="is-active"
          class="nav-item"
          (click)="onNavClick(item)"
        >
          <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
          <span class="nav-label">{{ item.label }}</span>
          <span *ngIf="item.badge" class="nav-badge">{{ item.badge }}</span>
        </a>
      </nav>

      <!-- Footer -->
      <div class="drawer-footer">
        <ng-content select="[drawerFooter]"></ng-content>
      </div>
    </aside>
  `,
  styles: [`
    @use '../../../../styles/tokens' as *;

    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: $color-overlay;
      opacity: 0;
      visibility: hidden;
      transition: opacity $transition-drawer, visibility $transition-drawer;
      z-index: $z-drawer-backdrop;

      &.is-open {
        opacity: 1;
        visibility: visible;
      }
    }

    .drawer-panel {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: $drawer-width;
      max-width: 85vw;
      background: $drawer-bg;
      transform: translateX(-100%);
      transition: transform $transition-drawer, visibility $transition-drawer;
      z-index: $z-drawer;
      display: flex;
      flex-direction: column;
      box-shadow: $shadow-xl;
      visibility: hidden;

      &.is-open {
        transform: translateX(0);
        visibility: visible;
      }
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: $space-4 $space-6;
      border-bottom: 1px solid $color-border;
      height: $header-height;
    }

    .brand {
      font-size: $font-size-lg;
      font-weight: $font-weight-light;
      letter-spacing: $letter-spacing-wider;
      color: $color-text-primary;
    }

    .close-button {
      color: $color-text-secondary;

      &:hover {
        color: $color-text-primary;
        background: $color-bg-tertiary;
      }
    }

    .drawer-nav {
      flex: 1;
      padding: $space-4 0;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: $space-4;
      padding: $space-4 $space-6;
      color: $color-text-secondary;
      text-decoration: none;
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      letter-spacing: $letter-spacing-wide;
      text-transform: uppercase;
      transition: all $transition-fast;
      border-left: 3px solid transparent;

      &:hover {
        background: $color-bg-secondary;
        color: $color-text-primary;
      }

      &.is-active {
        color: $color-accent-gold;
        background: $color-accent-gold-light;
        border-left-color: $color-accent-gold;

        .nav-icon {
          color: $color-accent-gold;
        }
      }
    }

    .nav-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: $color-text-muted;
      transition: color $transition-fast;
    }

    .nav-label {
      flex: 1;
    }

    .nav-badge {
      padding: $space-1 $space-2;
      font-size: $font-size-xs;
      font-weight: $font-weight-semibold;
      background: $color-accent-gold;
      color: $color-text-primary;
      border-radius: $radius-full;
      min-width: 24px;
      text-align: center;
    }

    .drawer-footer {
      padding: $space-6;
      border-top: 1px solid $color-border;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LuxeDrawerComponent {
  @Input() isOpen = false;
  @Input() navItems: DrawerNavItem[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() navItemClick = new EventEmitter<DrawerNavItem>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  onNavClick(item: DrawerNavItem): void {
    this.navItemClick.emit(item);
    this.close();
  }
}
