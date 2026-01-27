import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { CreditsService } from '../../services/credits.service';
import { StripeService } from '../../services/stripe.service';
import { TutorialService } from '../../services/tutorial.service';
import { CurrentSubscriptionDto } from '../../models/stripe';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly creditsService = inject(CreditsService);
  private readonly stripeService = inject(StripeService);
  private readonly tutorialService = inject(TutorialService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly email$ = this.authService.email$;
  readonly user$ = this.authService.user$;
  readonly balance = signal<number | null>(null);
  readonly subscription = signal<CurrentSubscriptionDto | null>(null);

  // Tutorial state - isTutorialActive is true when NOT completed
  get isTutorialCompleted(): boolean {
    return !this.tutorialService.isTutorialActive();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    forkJoin({
      subscription: this.stripeService.getCurrentSubscription(),
      balance: this.creditsService.refresh()
    }).subscribe({
      next: ({ subscription, balance }) => {
        this.subscription.set(subscription);
        this.balance.set(balance);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  getSubscriptionStatusLabel(): string {
    const sub = this.subscription();
    if (!sub || !sub.planName) return 'Free';
    return sub.planName;
  }

  getSubscriptionBillingCycle(): string {
    const sub = this.subscription();
    if (!sub || !sub.planName) return '';
    return sub.isAnnual ? 'Annual' : 'Monthly';
  }

  getNextBillingDate(): string | null {
    const sub = this.subscription();
    if (!sub || !sub.currentPeriodEnd) return null;
    return new Date(sub.currentPeriodEnd).toLocaleDateString();
  }

  manageSubscription(): void {
    this.stripeService.createPortalSession().subscribe({
      next: (portal) => {
        this.stripeService.redirectToPortal(portal.portalUrl);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/studio']);
    }
  }

  resetTutorial(): void {
    this.tutorialService.resetTutorial();
    this.snackBar.open('Tutorial reset! Visit the Studio to start again.', 'Go to Studio', {
      duration: 5000
    }).onAction().subscribe(() => {
      this.router.navigate(['/studio']);
    });
  }
}
