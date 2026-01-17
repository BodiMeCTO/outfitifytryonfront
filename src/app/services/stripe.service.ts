import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  SubscriptionPlanWithStripeDto,
  CreditPackageDto,
  CreateSubscriptionCheckoutRequest,
  CreateCreditPackageCheckoutRequest,
  CheckoutSessionDto,
  CustomerPortalDto,
  CurrentSubscriptionDto,
  StripeConfigDto,
  CheckoutSessionStatusDto
} from '../models/stripe';

@Injectable({ providedIn: 'root' })
export class StripeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl?.replace(/\/+$/, '') ?? '';

  private readonly _currentSubscription$ = new BehaviorSubject<CurrentSubscriptionDto | null>(null);
  readonly currentSubscription$ = this._currentSubscription$.asObservable();

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // Get Stripe publishable key for frontend
  getConfig(): Observable<StripeConfigDto> {
    return this.http.get<StripeConfigDto>(this.buildUrl('/api/stripe/config'));
  }

  // Get subscription plans
  getPlans(): Observable<SubscriptionPlanWithStripeDto[]> {
    return this.http.get<SubscriptionPlanWithStripeDto[]>(this.buildUrl('/api/stripe/plans'));
  }

  // Get credit packages
  getCreditPackages(): Observable<CreditPackageDto[]> {
    return this.http.get<CreditPackageDto[]>(this.buildUrl('/api/stripe/packages'));
  }

  // Create subscription checkout session
  createSubscriptionCheckout(request: CreateSubscriptionCheckoutRequest): Observable<CheckoutSessionDto> {
    return this.http.post<CheckoutSessionDto>(this.buildUrl('/api/stripe/checkout/subscription'), request);
  }

  // Create credit package checkout session
  createCreditPackageCheckout(request: CreateCreditPackageCheckoutRequest): Observable<CheckoutSessionDto> {
    return this.http.post<CheckoutSessionDto>(this.buildUrl('/api/stripe/checkout/credits'), request);
  }

  // Get customer portal URL
  createPortalSession(): Observable<CustomerPortalDto> {
    return this.http.post<CustomerPortalDto>(this.buildUrl('/api/stripe/portal'), {});
  }

  // Get current subscription
  getCurrentSubscription(): Observable<CurrentSubscriptionDto | null> {
    return this.http.get<CurrentSubscriptionDto | null>(this.buildUrl('/api/stripe/subscription'))
      .pipe(
        tap(sub => this._currentSubscription$.next(sub)),
        catchError(() => {
          this._currentSubscription$.next(null);
          return of(null);
        })
      );
  }

  // Verify checkout session status
  getCheckoutSessionStatus(sessionId: string): Observable<CheckoutSessionStatusDto | null> {
    return this.http.get<CheckoutSessionStatusDto>(this.buildUrl(`/api/stripe/checkout/${sessionId}`))
      .pipe(
        catchError(() => of(null))
      );
  }

  // Redirect to Stripe Checkout
  redirectToCheckout(checkoutUrl: string): void {
    window.location.href = checkoutUrl;
  }

  // Redirect to Customer Portal
  redirectToPortal(portalUrl: string): void {
    window.location.href = portalUrl;
  }

  // Clear subscription state (on logout)
  clear(): void {
    this._currentSubscription$.next(null);
  }
}
