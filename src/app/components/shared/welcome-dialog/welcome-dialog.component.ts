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
        <p class="info-message">
          Each outfit generation uses 1 credit. Use your trial credits to explore
          our virtual try-on features.
        </p>
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
