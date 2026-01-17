import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-billing-cancel',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="cancel-page">
      <mat-card appearance="outlined" class="cancel-card">
        <mat-card-content>
          <div class="cancel-icon">
            <mat-icon>cancel</mat-icon>
          </div>
          <h1>Payment Cancelled</h1>
          <p>Your payment was cancelled. No charges were made.</p>
          <p>If you have any questions, please contact support.</p>
          <div class="actions">
            <button mat-raised-button color="primary" (click)="goToBilling()">
              <mat-icon>arrow_back</mat-icon>
              Back to Billing
            </button>
            <button mat-stroked-button (click)="goToStudio()">
              <mat-icon>brush</mat-icon>
              Go to Studio
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .cancel-page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 24px;
      background: #FAF9F6;
    }

    .cancel-card {
      max-width: 480px;
      text-align: center;
      padding: 48px 32px;
      background: #FFFFFF !important;
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      border-radius: 12px !important;
    }

    .cancel-icon {
      margin-bottom: 24px;

      mat-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        color: #999999;
      }
    }

    h1 {
      margin: 0 0 16px;
      font-size: 1.5rem;
      font-weight: 300;
      letter-spacing: -0.02em;
      color: #111111;
    }

    p {
      color: #999999;
      margin-bottom: 8px;
      font-size: 0.875rem;
    }

    .actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-top: 32px;
      flex-wrap: wrap;

      button {
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
      }

      .mat-mdc-raised-button {
        background: #C9A96E !important;
        color: #111111 !important;
      }

      .mat-mdc-stroked-button {
        border-color: rgba(0, 0, 0, 0.16) !important;
        color: #1A1A1A !important;

        &:hover {
          background: #F5F4F0 !important;
        }
      }
    }
  `]
})
export class BillingCancelComponent {
  private readonly router = inject(Router);

  goToBilling(): void {
    this.router.navigate(['/billing']);
  }

  goToStudio(): void {
    this.router.navigate(['/studio']);
  }
}
