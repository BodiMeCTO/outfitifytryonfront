// Subscription Plans with Stripe info
export interface SubscriptionPlanWithStripeDto {
  id: string;
  name: string;
  monthlyCredits: number;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  displayOrder: number;
  stripeMonthlyPriceId: string | null;
  stripeAnnualPriceId: string | null;
  maxRolloverCredits: number;
}

// Credit Packages
export interface CreditPackageDto {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  stripePriceId: string;
  displayOrder: number;
}

// Checkout Requests
export interface CreateSubscriptionCheckoutRequest {
  planId: string;
  isAnnual: boolean;
}

export interface CreateCreditPackageCheckoutRequest {
  packageId: string;
}

// Checkout Response
export interface CheckoutSessionDto {
  sessionId: string;
  checkoutUrl: string;
}

// Portal Response
export interface CustomerPortalDto {
  portalUrl: string;
}

// Current Subscription
export interface CurrentSubscriptionDto {
  subscriptionId: string | null;
  planName: string | null;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  monthlyCredits: number;
  rolloverCredits: number;
  canUpgrade: boolean;
  canCancel: boolean;
  isAnnual: boolean;
  priceAmount: number | null;
}

// Stripe Config
export interface StripeConfigDto {
  publishableKey: string;
}

// Checkout Session Status (for verifying payment)
export interface CheckoutSessionStatusDto {
  sessionId: string;
  status: 'complete' | 'expired' | 'open';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required' | null;
  creditsGranted: number | null;
  planName: string | null;
}
