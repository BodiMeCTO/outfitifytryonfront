import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-luxe-carousel',
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="carousel-container" [class.has-label]="label">
      <!-- Section label -->
      <div class="carousel-header" *ngIf="label">
        <h3 class="carousel-label">{{ label }}</h3>
        <span class="item-count" *ngIf="showCount">{{ itemCount }} items</span>
      </div>

      <!-- Carousel wrapper -->
      <div class="carousel-wrapper">
        <!-- Left scroll button (desktop only) -->
        <button
          *ngIf="showArrows && canScrollLeft()"
          mat-icon-button
          class="scroll-button scroll-left"
          (click)="scrollLeft()"
          aria-label="Scroll left"
        >
          <mat-icon>chevron_left</mat-icon>
        </button>

        <!-- Scrollable track -->
        <div
          #track
          class="carousel-track"
          [style.gap]="gap"
          (scroll)="onScroll()"
        >
          <ng-content></ng-content>
        </div>

        <!-- Right scroll button (desktop only) -->
        <button
          *ngIf="showArrows && canScrollRight()"
          mat-icon-button
          class="scroll-button scroll-right"
          (click)="scrollRight()"
          aria-label="Scroll right"
        >
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>

      <!-- Scroll indicators (mobile) -->
      <div class="scroll-indicators" *ngIf="showIndicators && totalPages > 1">
        <span
          *ngFor="let page of pages; let i = index"
          class="indicator"
          [class.active]="i === currentPage()"
        ></span>
      </div>
    </div>
  `,
  styles: [`
    @use '../../../../styles/tokens' as *;

    :host {
      display: block;
    }

    .carousel-container {
      position: relative;
    }

    .carousel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: $space-4;
    }

    .carousel-label {
      font-size: $font-size-xs;
      font-weight: $font-weight-semibold;
      text-transform: uppercase;
      letter-spacing: $letter-spacing-wider;
      color: $color-text-muted;
      margin: 0;
      position: relative;
      padding-left: $space-3;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 16px;
        background: $color-accent-gold;
        border-radius: 2px;
      }
    }

    .item-count {
      font-size: $font-size-xs;
      color: $color-text-muted;
    }

    .carousel-wrapper {
      position: relative;
    }

    .carousel-track {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding: $space-1 0;
      margin: 0 (-$space-1);
      padding-left: $space-1;
      padding-right: $space-1;

      &::-webkit-scrollbar {
        display: none;
      }

      > :deep(*) {
        flex-shrink: 0;
        scroll-snap-align: start;
      }
    }

    .scroll-button {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      background: rgba($color-bg-primary, 0.95) !important;
      backdrop-filter: blur(8px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      border: 1px solid rgba($color-border, 0.5);
      width: 32px;
      height: 32px;
      display: none;
      transition: all $transition-fast;

      @include lg {
        display: flex;
      }

      &:hover {
        background: $color-bg-primary !important;
        border-color: $color-accent-gold;
        box-shadow: 0 4px 12px rgba($color-accent-gold, 0.2);
        transform: translateY(-50%) scale(1.05);

        mat-icon {
          color: $color-accent-gold;
        }
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: $color-text-muted;
        transition: color $transition-fast;
      }
    }

    .scroll-left {
      left: $space-2;
    }

    .scroll-right {
      right: $space-2;
    }

    .scroll-indicators {
      display: flex;
      justify-content: center;
      gap: $space-2;
      margin-top: $space-4;

      @include lg {
        display: none;
      }
    }

    .indicator {
      width: 8px;
      height: 8px;
      border-radius: $radius-full;
      background: $color-border-strong;
      transition: all $transition-fast;

      &.active {
        width: 24px;
        background: $color-accent-gold;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LuxeCarouselComponent implements AfterViewInit, OnDestroy {
  @ViewChild('track') trackRef!: ElementRef<HTMLElement>;

  @Input() label?: string;
  @Input() gap = '1rem';
  @Input() showArrows = true;
  @Input() showIndicators = true;
  @Input() showCount = false;
  @Input() itemCount = 0;
  @Input() scrollAmount = 300;

  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(true);
  readonly currentPage = signal(0);

  totalPages = 1;
  pages: number[] = [];

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  constructor(private readonly ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.updateScrollState();
    this.calculatePages();
    this.setupObservers();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  /**
   * Public method to force refresh carousel state.
   * Call this when content changes dynamically.
   */
  refreshState(): void {
    requestAnimationFrame(() => {
      this.updateScrollState();
      this.calculatePages();
    });
  }

  private setupObservers(): void {
    const track = this.trackRef?.nativeElement;
    if (!track) return;

    // ResizeObserver for container size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.ngZone.run(() => {
        this.updateScrollState();
        this.calculatePages();
      });
    });
    this.resizeObserver.observe(track);

    // MutationObserver for child element changes (items added/removed)
    this.mutationObserver = new MutationObserver(() => {
      this.ngZone.run(() => {
        // Debounce rapid changes with requestAnimationFrame
        requestAnimationFrame(() => {
          this.updateScrollState();
          this.calculatePages();
        });
      });
    });
    this.mutationObserver.observe(track, {
      childList: true,
      subtree: false
    });
  }

  onScroll(): void {
    this.updateScrollState();
    this.updateCurrentPage();
  }

  scrollLeft(): void {
    const track = this.trackRef?.nativeElement;
    if (track) {
      track.scrollBy({ left: -this.scrollAmount, behavior: 'smooth' });
    }
  }

  scrollRight(): void {
    const track = this.trackRef?.nativeElement;
    if (track) {
      track.scrollBy({ left: this.scrollAmount, behavior: 'smooth' });
    }
  }

  private updateScrollState(): void {
    const track = this.trackRef?.nativeElement;
    if (!track) return;

    const { scrollLeft, scrollWidth, clientWidth } = track;
    this.canScrollLeft.set(scrollLeft > 0);
    this.canScrollRight.set(scrollLeft + clientWidth < scrollWidth - 1);
  }

  private calculatePages(): void {
    const track = this.trackRef?.nativeElement;
    if (!track) return;

    const { scrollWidth, clientWidth } = track;
    this.totalPages = Math.ceil(scrollWidth / clientWidth);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i);
  }

  private updateCurrentPage(): void {
    const track = this.trackRef?.nativeElement;
    if (!track) return;

    const { scrollLeft, clientWidth } = track;
    this.currentPage.set(Math.round(scrollLeft / clientWidth));
  }
}
