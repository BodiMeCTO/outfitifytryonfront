import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

import { StripeService } from '../../services/stripe.service';
import { CreditsService } from '../../services/credits.service';
import {
  SubscriptionPlanWithStripeDto,
  CreditPackageDto,
  CurrentSubscriptionDto
} from '../../models/stripe';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillingComponent implements OnInit {
  private readonly stripeService = inject(StripeService);
  private readonly creditsService = inject(CreditsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly isProcessing = signal(false);
  readonly plans = signal<SubscriptionPlanWithStripeDto[]>([]);
  readonly packages = signal<CreditPackageDto[]>([]);
  readonly currentSubscription = signal<CurrentSubscriptionDto | null>(null);
  readonly balance = signal<number | null>(null);
  // Default to annual billing for better value (#31)
  readonly selectedBillingCycle = signal<'monthly' | 'annual'>('annual');

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    forkJoin({
      plans: this.stripeService.getPlans(),
      packages: this.stripeService.getCreditPackages(),
      subscription: this.stripeService.getCurrentSubscription()
    }).subscribe({
      next: ({ plans, packages, subscription }) => {
        this.plans.set(plans.sort((a, b) => a.displayOrder - b.displayOrder));
        this.packages.set(packages.sort((a, b) => a.displayOrder - b.displayOrder));
        this.currentSubscription.set(subscription);
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('Failed to load billing information', 'Dismiss', { duration: 3000 });
        this.isLoading.set(false);
      }
    });

    this.creditsService.refresh().subscribe(balance => this.balance.set(balance));
  }

  selectPlan(plan: SubscriptionPlanWithStripeDto): void {
    this.isProcessing.set(true);
    const isAnnual = this.selectedBillingCycle() === 'annual';

    this.stripeService.createSubscriptionCheckout({ planId: plan.id, isAnnual }).subscribe({
      next: (session) => {
        this.stripeService.redirectToCheckout(session.checkoutUrl);
      },
      error: () => {
        this.snackBar.open('Failed to create checkout session', 'Dismiss', { duration: 3000 });
        this.isProcessing.set(false);
      }
    });
  }

  purchasePackage(pkg: CreditPackageDto): void {
    this.isProcessing.set(true);

    this.stripeService.createCreditPackageCheckout({ packageId: pkg.id }).subscribe({
      next: (session) => {
        this.stripeService.redirectToCheckout(session.checkoutUrl);
      },
      error: () => {
        this.snackBar.open('Failed to create checkout session', 'Dismiss', { duration: 3000 });
        this.isProcessing.set(false);
      }
    });
  }

  manageSubscription(): void {
    this.isProcessing.set(true);

    this.stripeService.createPortalSession().subscribe({
      next: (portal) => {
        this.stripeService.redirectToPortal(portal.portalUrl);
      },
      error: () => {
        this.snackBar.open('Failed to open billing portal', 'Dismiss', { duration: 3000 });
        this.isProcessing.set(false);
      }
    });
  }

  toggleBillingCycle(): void {
    this.selectedBillingCycle.set(
      this.selectedBillingCycle() === 'monthly' ? 'annual' : 'monthly'
    );
  }

  getPlanPrice(plan: SubscriptionPlanWithStripeDto): number {
    return this.selectedBillingCycle() === 'annual'
      ? plan.annualPrice
      : plan.monthlyPrice;
  }

  getAnnualSavings(plan: SubscriptionPlanWithStripeDto): number {
    return (plan.monthlyPrice * 12) - plan.annualPrice;
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/studio']);
    }
  }
}
