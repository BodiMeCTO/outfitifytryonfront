import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CreditsService } from '../../services/credits.service';
import { StripeService } from '../../services/stripe.service';
import { CheckoutSessionStatusDto } from '../../models/stripe';

@Component({
  selector: 'app-billing-success',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="success-page">
      <mat-card appearance="outlined" class="success-card">
        <mat-card-content>
          <!-- Loading state -->
          @if (isVerifying()) {
            <div class="loading-icon">
              <mat-spinner diameter="64"></mat-spinner>
            </div>
            <h1>Verifying Payment...</h1>
            <p>Please wait while we confirm your payment.</p>
          }

          <!-- Success state -->
          @if (!isVerifying() && paymentStatus() === 'paid') {
            <div class="success-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h1>Payment Successful!</h1>
            @if (sessionStatus()?.planName) {
              <p>Your purchase of <strong>{{ sessionStatus()?.planName }}</strong> has been confirmed.</p>
            } @else {
              <p>Your payment has been processed successfully.</p>
            }
            @if (sessionStatus()?.creditsGranted) {
              <p class="credits-granted">
                <mat-icon>add_circle</mat-icon>
                {{ sessionStatus()?.creditsGranted }} credits added to your account
              </p>
            }
            @if (newBalance() !== null) {
              <p class="balance">
                Your new balance: <strong>{{ newBalance() }} credits</strong>
              </p>
            }
            <div class="actions">
              <button mat-raised-button color="primary" (click)="goToStudio()">
                <mat-icon>brush</mat-icon>
                Go to Studio
              </button>
              <button mat-stroked-button (click)="goToBilling()">
                <mat-icon>receipt</mat-icon>
                View Billing
              </button>
            </div>
          }

          <!-- Processing state (webhook hasn't processed yet) -->
          @if (!isVerifying() && paymentStatus() === 'processing') {
            <div class="processing-icon">
              <mat-icon>schedule</mat-icon>
            </div>
            <h1>Payment Processing</h1>
            <p>Your payment is being processed. Credits will be added to your account shortly.</p>
            <p class="hint">This usually takes just a few seconds. You can check your balance in the billing page.</p>
            <div class="actions">
              <button mat-raised-button color="primary" (click)="goToBilling()">
                <mat-icon>refresh</mat-icon>
                Check Billing
              </button>
              <button mat-stroked-button (click)="goToStudio()">
                <mat-icon>brush</mat-icon>
                Go to Studio
              </button>
            </div>
          }

          <!-- Failed/Error state -->
          @if (!isVerifying() && paymentStatus() === 'failed') {
            <div class="error-icon">
              <mat-icon>error</mat-icon>
            </div>
            <h1>Payment Issue</h1>
            <p>We couldn't verify your payment. This could be due to:</p>
            <ul>
              <li>Payment was declined or cancelled</li>
              <li>Session expired</li>
              <li>Network issue</li>
            </ul>
            <div class="actions">
              <button mat-raised-button color="primary" (click)="goToBilling()">
                <mat-icon>refresh</mat-icon>
                Try Again
              </button>
              <button mat-stroked-button (click)="goToStudio()">
                <mat-icon>brush</mat-icon>
                Go to Studio
              </button>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .success-page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 24px;
      background: #FAF9F6;
    }

    .success-card {
      max-width: 480px;
      text-align: center;
      padding: 48px 32px;
      background: #FFFFFF !important;
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      border-radius: 12px !important;
    }

    .loading-icon, .success-icon, .processing-icon, .error-icon {
      margin-bottom: 24px;
      display: flex;
      justify-content: center;

      mat-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
      }
    }

    .success-icon mat-icon {
      color: #C9A96E;
    }

    .processing-icon mat-icon {
      color: #C9A96E;
      opacity: 0.7;
    }

    .error-icon mat-icon {
      color: #F44336;
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

    .credits-granted {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #C9A96E;
      font-weight: 500;
      margin: 24px 0;
      padding: 12px 24px;
      background: rgba(201, 169, 110, 0.12);
      border-radius: 9999px;
      font-size: 0.875rem;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .balance {
      font-size: 1.125rem;
      color: #111111;
      margin: 24px 0;

      strong {
        color: #C9A96E;
        font-weight: 600;
      }
    }

    .hint {
      font-size: 0.75rem;
      font-style: italic;
      color: #999999;
    }

    ul {
      text-align: left;
      margin: 16px auto;
      max-width: 280px;
      color: #999999;
      font-size: 0.875rem;

      li {
        margin-bottom: 8px;
      }
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

    ::ng-deep .mat-mdc-progress-spinner circle {
      stroke: #C9A96E !important;
    }
  `]
})
export class BillingSuccessComponent implements OnInit {
  private readonly creditsService = inject(CreditsService);
  private readonly stripeService = inject(StripeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isVerifying = signal(true);
  readonly paymentStatus = signal<'paid' | 'processing' | 'failed'>('processing');
  readonly sessionStatus = signal<CheckoutSessionStatusDto | null>(null);
  readonly newBalance = signal<number | null>(null);

  ngOnInit(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (sessionId) {
      this.verifyPayment(sessionId);
    } else {
      // No session_id - show processing state and refresh balance
      this.isVerifying.set(false);
      this.paymentStatus.set('processing');
      this.refreshBalance();
    }
  }

  private verifyPayment(sessionId: string): void {
    this.stripeService.getCheckoutSessionStatus(sessionId).subscribe({
      next: (status) => {
        this.sessionStatus.set(status);

        if (status?.status === 'complete' && status?.paymentStatus === 'paid') {
          this.paymentStatus.set('paid');
          this.refreshBalance();
        } else if (status?.status === 'complete') {
          // Session complete but payment not marked as paid yet (webhook processing)
          this.paymentStatus.set('processing');
          this.refreshBalance();
        } else if (status?.status === 'expired' || !status) {
          this.paymentStatus.set('failed');
        } else {
          // Session still open - redirect back to billing
          this.paymentStatus.set('processing');
        }

        this.isVerifying.set(false);
      },
      error: () => {
        // Can't verify - assume processing
        this.paymentStatus.set('processing');
        this.isVerifying.set(false);
        this.refreshBalance();
      }
    });
  }

  private refreshBalance(): void {
    this.creditsService.refresh().subscribe({
      next: (balance) => {
        this.newBalance.set(balance);
      },
      error: () => {
        // Silently fail - balance will show when they go to billing
      }
    });
  }

  goToStudio(): void {
    this.router.navigate(['/studio']);
  }

  goToBilling(): void {
    this.router.navigate(['/billing']);
  }
}
