import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-welcome-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="welcome-dialog">
      <div class="welcome-icon">
        <mat-icon>card_giftcard</mat-icon>
      </div>

      <h2 mat-dialog-title>Welcome to Outfitify!</h2>

      <mat-dialog-content>
        <p class="gift-message">
          You've been gifted <strong>25 trial credits</strong> to get started!
        </p>

        <!-- How it works - 3 step explanation (#11) -->
        <div class="how-it-works">
          <h3>How it works:</h3>
          <ol class="steps-list">
            <li>
              <span class="step-icon"><mat-icon>person</mat-icon></span>
              <span class="step-text">Upload a photo of yourself</span>
            </li>
            <li>
              <span class="step-icon"><mat-icon>checkroom</mat-icon></span>
              <span class="step-text">Add garments you want to try</span>
            </li>
            <li>
              <span class="step-icon"><mat-icon>auto_awesome</mat-icon></span>
              <span class="step-text">Generate your virtual try-on</span>
            </li>
          </ol>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="center">
        <button mat-stroked-button (click)="goToBilling()">
          <mat-icon>shopping_cart</mat-icon>
          Purchase More Credits
        </button>
        <button mat-raised-button color="primary" (click)="startCreating()">
          <mat-icon>brush</mat-icon>
          Start Creating
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .welcome-dialog {
      text-align: center;
      padding: 16px;
    }

    .welcome-icon {
      margin-bottom: 16px;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-primary);
      }
    }

    h2 {
      margin: 0 0 16px;
      font-size: 24px;
      font-weight: 500;
    }

    mat-dialog-content {
      padding: 0 24px;
    }

    .gift-message {
      font-size: 18px;
      margin-bottom: 16px;
      color: var(--mat-sys-on-surface);

      strong {
        color: var(--mat-sys-primary);
        font-weight: 600;
      }
    }

    .info-message {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 8px;
    }

    /* How it works section (#11) */
    .how-it-works {
      margin-top: 20px;
      padding: 16px;
      background: rgba(var(--mat-sys-primary-rgb), 0.05);
      border-radius: 12px;
      text-align: left;

      h3 {
        margin: 0 0 12px;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .steps-list {
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: step-counter;

      li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(var(--mat-sys-outline-rgb), 0.1);

        &:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        &:first-child {
          padding-top: 0;
        }
      }
    }

    .step-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--mat-sys-primary);
      flex-shrink: 0;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-on-primary);
      }
    }

    .step-text {
      font-size: 14px;
      color: var(--mat-sys-on-surface);
      font-weight: 500;
    }

    mat-dialog-actions {
      padding: 16px 0 0;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
  `]
})
export class WelcomeDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<WelcomeDialogComponent>);
  private readonly router = inject(Router);

  startCreating(): void {
    this.dialogRef.close();
  }

  goToBilling(): void {
    this.dialogRef.close();
    this.router.navigate(['/billing']);
  }
}
