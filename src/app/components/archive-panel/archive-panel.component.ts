import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';

import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { ModelImageDto, OutfitService } from '../../services/outfit.service';
import { GarmentSummaryDto } from '../../models/outfitify-api';

interface ArchivedModelImage {
  modelImageId: string;
  name: string;
  imageUrl: string;
  archivedAtUtc: string;
}

interface ArchivedGarment {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  archivedAtUtc: string;
}

@Component({
  standalone: true,
  selector: 'app-archive-panel',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <!-- Backdrop -->
    <div
      class="archive-backdrop"
      [class.is-open]="isOpen"
      (click)="close()"
    ></div>

    <!-- Panel -->
    <aside
      class="archive-panel"
      [class.is-open]="isOpen"
      role="dialog"
      aria-label="Archive"
    >
      <!-- Header -->
      <div class="panel-header">
        <h2 class="panel-title">Archive</h2>
        <button
          mat-icon-button
          class="close-button"
          (click)="close()"
          aria-label="Close archive"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Tabs -->
      <mat-tab-group class="archive-tabs" animationDuration="200ms">
        <!-- Model Images Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">person</mat-icon>
            <span class="tab-label">Models</span>
            <span class="tab-badge" *ngIf="archivedModelImages().length > 0">
              {{ archivedModelImages().length }}
            </span>
          </ng-template>

          <div class="tab-content">
            <div class="loading-container" *ngIf="isLoadingModelImages()">
              <mat-spinner diameter="32"></mat-spinner>
            </div>

            <div class="empty-state" *ngIf="!isLoadingModelImages() && archivedModelImages().length === 0">
              <mat-icon class="empty-icon">inventory_2</mat-icon>
              <p class="empty-text">No archived model images</p>
            </div>

            <div class="archive-grid" *ngIf="!isLoadingModelImages() && archivedModelImages().length > 0">
              <div
                class="archive-item"
                *ngFor="let item of archivedModelImages()"
              >
                <div class="item-image">
                  <img [src]="item.imageUrl" [alt]="item.name" />
                </div>
                <div class="item-info">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-date">{{ formatDate(item.archivedAtUtc) }}</span>
                </div>
                <button
                  mat-icon-button
                  class="unarchive-button"
                  (click)="unarchiveModelImage(item)"
                  [disabled]="isUnarchiving()"
                  aria-label="Restore"
                >
                  <mat-icon>unarchive</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Garments Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">checkroom</mat-icon>
            <span class="tab-label">Garments</span>
            <span class="tab-badge" *ngIf="archivedGarments().length > 0">
              {{ archivedGarments().length }}
            </span>
          </ng-template>

          <div class="tab-content">
            <div class="loading-container" *ngIf="isLoadingGarments()">
              <mat-spinner diameter="32"></mat-spinner>
            </div>

            <div class="empty-state" *ngIf="!isLoadingGarments() && archivedGarments().length === 0">
              <mat-icon class="empty-icon">inventory_2</mat-icon>
              <p class="empty-text">No archived garments</p>
            </div>

            <div class="archive-grid" *ngIf="!isLoadingGarments() && archivedGarments().length > 0">
              <div
                class="archive-item"
                *ngFor="let item of archivedGarments()"
              >
                <div class="item-image">
                  <img [src]="item.imageUrl" [alt]="item.name" />
                </div>
                <div class="item-info">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-category">{{ item.category }}</span>
                  <span class="item-date">{{ formatDate(item.archivedAtUtc) }}</span>
                </div>
                <button
                  mat-icon-button
                  class="unarchive-button"
                  (click)="unarchiveGarment(item)"
                  [disabled]="isUnarchiving()"
                  aria-label="Restore"
                >
                  <mat-icon>unarchive</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </aside>
  `,
  styles: [`
    @use '../../../styles/tokens' as *;

    .archive-backdrop {
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

    .archive-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 380px;
      max-width: 90vw;
      background: $color-bg-primary;
      transform: translateX(100%);
      transition: transform $transition-drawer;
      z-index: $z-drawer;
      display: flex;
      flex-direction: column;
      box-shadow: $shadow-xl;

      &.is-open {
        transform: translateX(0);
      }
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: $space-4 $space-6;
      border-bottom: 1px solid $color-border;
      min-height: $header-height;
    }

    .panel-title {
      font-size: $font-size-lg;
      font-weight: $font-weight-medium;
      letter-spacing: $letter-spacing-wide;
      color: $color-text-primary;
      margin: 0;
      text-transform: uppercase;
    }

    .close-button {
      color: $color-text-secondary;

      &:hover {
        color: $color-text-primary;
        background: $color-bg-tertiary;
      }
    }

    .archive-tabs {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      ::ng-deep {
        .mat-mdc-tab-header {
          border-bottom: 1px solid $color-border;
        }

        .mat-mdc-tab {
          min-width: 120px;
          opacity: 0.7;

          &.mdc-tab--active {
            opacity: 1;
          }
        }

        .mat-mdc-tab-body-wrapper {
          flex: 1;
          overflow: hidden;
        }

        .mat-mdc-tab-body-content {
          height: 100%;
          overflow-y: auto;
        }

        .mdc-tab__text-label {
          color: $color-text-secondary;
        }

        .mdc-tab--active .mdc-tab__text-label {
          color: $color-accent-gold;
        }

        .mdc-tab-indicator__content--underline {
          border-color: $color-accent-gold;
        }
      }
    }

    .tab-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: $space-2;
    }

    .tab-label {
      font-size: $font-size-sm;
      text-transform: uppercase;
      letter-spacing: $letter-spacing-wide;
    }

    .tab-badge {
      margin-left: $space-2;
      padding: 2px $space-2;
      font-size: $font-size-xs;
      font-weight: $font-weight-semibold;
      background: $color-accent-gold;
      color: $color-text-primary;
      border-radius: $radius-full;
      min-width: 20px;
      text-align: center;
    }

    .tab-content {
      padding: $space-4;
      height: 100%;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: $space-8;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: $space-8;
      text-align: center;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: $color-text-muted;
      margin-bottom: $space-4;
    }

    .empty-text {
      font-size: $font-size-sm;
      color: $color-text-secondary;
      margin: 0;
    }

    .archive-grid {
      display: flex;
      flex-direction: column;
      gap: $space-3;
    }

    .archive-item {
      display: flex;
      align-items: center;
      gap: $space-3;
      padding: $space-3;
      background: $color-bg-secondary;
      border-radius: $radius-md;
      border: 1px solid $color-border;
      transition: all $transition-fast;

      &:hover {
        background: $color-bg-tertiary;
        border-color: $color-accent-gold-light;
      }
    }

    .item-image {
      width: 56px;
      height: 56px;
      border-radius: $radius-sm;
      overflow: hidden;
      flex-shrink: 0;
      background: $color-bg-tertiary;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .item-name {
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: $color-text-primary;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-category {
      font-size: $font-size-xs;
      color: $color-accent-gold;
      text-transform: capitalize;
    }

    .item-date {
      font-size: $font-size-xs;
      color: $color-text-muted;
    }

    .unarchive-button {
      flex-shrink: 0;
      color: $color-accent-gold;

      &:hover:not(:disabled) {
        background: $color-accent-gold-light;
      }

      &:disabled {
        opacity: 0.5;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArchivePanelComponent implements OnInit, OnChanges {
  private readonly apiService = inject(OutfitifyApiService);
  private readonly outfitService = inject(OutfitService);
  private readonly snackBar = inject(MatSnackBar);

  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() itemRestored = new EventEmitter<void>();

  readonly archivedModelImages = signal<ArchivedModelImage[]>([]);
  readonly archivedGarments = signal<ArchivedGarment[]>([]);
  readonly isLoadingModelImages = signal(false);
  readonly isLoadingGarments = signal(false);
  readonly isUnarchiving = signal(false);

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  ngOnInit(): void {
    this.loadArchivedItems();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload archived items whenever the panel is opened
    if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
      this.loadArchivedItems();
    }
  }

  close(): void {
    this.closed.emit();
  }

  loadArchivedItems(): void {
    this.loadArchivedModelImages();
    this.loadArchivedGarments();
  }

  private loadArchivedModelImages(): void {
    this.isLoadingModelImages.set(true);
    this.apiService.listModelImages(undefined, true).pipe(take(1)).subscribe({
      next: (items: ModelImageDto[]) => {
        const archived = items
          .filter(item => item.archivedAtUtc)
          .map(item => ({
            modelImageId: item.modelImageId,
            name: item.name || 'Unnamed',
            imageUrl: item.imageUrl || '',
            archivedAtUtc: item.archivedAtUtc!
          }));
        this.archivedModelImages.set(archived);
        this.isLoadingModelImages.set(false);
      },
      error: () => {
        this.isLoadingModelImages.set(false);
        this.snackBar.open('Failed to load archived model images', 'Dismiss', { duration: 3000 });
      }
    });
  }

  private loadArchivedGarments(): void {
    this.isLoadingGarments.set(true);
    this.apiService.listGarments(true).pipe(take(1)).subscribe({
      next: (items: GarmentSummaryDto[]) => {
        const archived = items
          .filter(item => item.archivedAtUtc || (item as any).ArchivedAtUtc)
          .map(item => {
            // Handle property name mismatch between backend (garmentEntityId, group) and frontend (id, category)
            const rawItem = item as any;
            return {
              id: item.id || rawItem.garmentEntityId || rawItem.GarmentEntityId,
              name: item.name || rawItem.Name || 'Unnamed',
              imageUrl: item.imageUrl || rawItem.ImageUrl || '',
              category: item.category || rawItem.group || rawItem.Group || 'Unknown',
              archivedAtUtc: item.archivedAtUtc || rawItem.ArchivedAtUtc
            };
          });
        this.archivedGarments.set(archived);
        this.isLoadingGarments.set(false);
      },
      error: () => {
        this.isLoadingGarments.set(false);
        this.snackBar.open('Failed to load archived garments', 'Dismiss', { duration: 3000 });
      }
    });
  }

  unarchiveModelImage(item: ArchivedModelImage): void {
    this.isUnarchiving.set(true);
    this.apiService.unarchiveModelImage(item.modelImageId).pipe(take(1)).subscribe({
      next: () => {
        this.archivedModelImages.update(items => items.filter(i => i.modelImageId !== item.modelImageId));
        this.snackBar.open('Model image restored', 'Dismiss', { duration: 3000 });
        this.isUnarchiving.set(false);
        this.itemRestored.emit();
        // Refresh the user model images in the outfit service
        this.outfitService.forceReloadUserModelImages().pipe(take(1)).subscribe();
      },
      error: () => {
        this.isUnarchiving.set(false);
        this.snackBar.open('Failed to restore model image', 'Dismiss', { duration: 3000 });
      }
    });
  }

  unarchiveGarment(item: ArchivedGarment): void {
    this.isUnarchiving.set(true);
    this.apiService.unarchiveGarment(item.id).pipe(take(1)).subscribe({
      next: () => {
        this.archivedGarments.update(items => items.filter(i => i.id !== item.id));
        this.snackBar.open('Garment restored', 'Dismiss', { duration: 3000 });
        this.isUnarchiving.set(false);
        this.itemRestored.emit();
        // Refresh garments in the outfit service
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
      },
      error: () => {
        this.isUnarchiving.set(false);
        this.snackBar.open('Failed to restore garment', 'Dismiss', { duration: 3000 });
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
