import { Routes } from '@angular/router';

import { authGuard, redirectToLoginGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
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
        redirectTo: 'generated-gallery',
        pathMatch: 'full'
      },
      {
        path: 'user-image-upload',
        loadComponent: () =>
          import('./components/user-image-upload/user-image-upload.component')
            .then((m) => m.UserImageUploadComponent),
        title: 'Upload User Image'
      },
      {
        path: 'background-image-upload',
        loadComponent: () =>
          import('./components/background-image-upload/background-image-upload.component')
            .then((m) => m.BackgroundImageUploadComponent),
        title: 'Choose Background'
      },
      {
        path: 'garment-library',
        loadComponent: () =>
          import('./components/garment-library/garment-library.component')
            .then((m) => m.GarmentLibraryComponent),
        title: 'Choose Garments'
      },
      {
        path: 'size-and-submit',
        loadComponent: () =>
          import('./components/size-selection/size-selection.component')
            .then((m) => m.SizeSelectionComponent),
        title: 'Select Size & Create Outfit'
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
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'generated-gallery'
  }
];
