import { Routes } from '@angular/router';

import { authGuard, noAuthGuard, redirectToLoginGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [noAuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login'
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./components/auth/login/login.component').then((m) => m.LoginComponent),
        title: 'Sign in'
      },
      {
        path: 'signup',
        loadComponent: () =>
          import('./components/auth/signup/signup.component').then((m) => m.SignupComponent),
        title: 'Create account'
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./components/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent
          ),
        title: 'Forgot password'
      }
    ]
  },
  {
    path: '',
    canActivate: [redirectToLoginGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'studio',
        pathMatch: 'full'
      },
      {
        path: 'studio',
        loadComponent: () =>
          import('./components/studio/studio.component')
            .then((m) => m.StudioComponent),
        title: 'Outfitify Studio'
      },
      {
        path: 'generated-gallery',
        loadComponent: () =>
          import('./components/outfit-gallery/outfit-gallery.component')
            .then((m) => m.OutfitGalleryComponent),
        title: 'Generated Outfits'
      },
      {
        path: 'archive',
        loadComponent: () =>
          import('./components/archive-page/archive-page.component')
            .then((m) => m.ArchivePageComponent),
        title: 'Archive'
      },
      {
        path: 'review-image/:id',
        loadComponent: () =>
          import('./components/image-review/image-review.component')
            .then((m) => m.ImageReviewComponent),
        title: 'Review Generated Image'
      },
      {
        path: 'credits',
        loadComponent: () =>
          import('./components/credits/credits.component')
            .then((m) => m.CreditsComponent),
        title: 'Credits'
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./components/account/account.component')
            .then((m) => m.AccountComponent),
        title: 'Account'
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./components/billing/billing.component')
            .then((m) => m.BillingComponent),
        title: 'Billing & Credits'
      },
      {
        path: 'billing/success',
        loadComponent: () =>
          import('./components/billing/billing-success.component')
            .then((m) => m.BillingSuccessComponent),
        title: 'Payment Successful'
      },
      {
        path: 'billing/cancel',
        loadComponent: () =>
          import('./components/billing/billing-cancel.component')
            .then((m) => m.BillingCancelComponent),
        title: 'Payment Cancelled'
      },
      // Legacy routes (redirect to studio)
      {
        path: 'user-image-upload',
        redirectTo: 'studio',
        pathMatch: 'full'
      },
      {
        path: 'background-image-upload',
        redirectTo: 'studio',
        pathMatch: 'full'
      },
      {
        path: 'garment-library',
        redirectTo: 'studio',
        pathMatch: 'full'
      },
      {
        path: 'size-and-submit',
        redirectTo: 'studio',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
