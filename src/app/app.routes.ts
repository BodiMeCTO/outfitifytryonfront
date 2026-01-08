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
