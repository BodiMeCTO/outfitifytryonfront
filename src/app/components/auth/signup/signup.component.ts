import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize, switchMap } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  static readonly passwordsMatch: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  };

  readonly form = this.fb.group(
    {
      fullName: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: SignupComponent.passwordsMatch }
  );

  loading = false;
  error: string | null = null;
  hidePassword = true;
  hideConfirmPassword = true;

  onSubmit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    const { email, password, confirmPassword, fullName } = this.form.getRawValue();

    if (!email || !password || !confirmPassword) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.auth
      .signup({ email, password, confirmPassword, fullName: fullName || undefined })
      .pipe(
        switchMap(() => this.auth.login(email, password)),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          // Set flag to show welcome dialog for new users
          localStorage.setItem('outfitify_new_user', 'true');
          this.router.navigateByUrl('/studio');
        },
        error: (err) => {
          this.error = this.buildErrorMessage(err);
          this.cdr.markForCheck();
        }
      });
  }

  private buildErrorMessage(err: any): string {
    const rawErrors = err?.error?.errors;

    if (Array.isArray(rawErrors) && rawErrors.length) {
      return rawErrors.join(' ');
    }

    if (rawErrors && typeof rawErrors === 'object') {
      const collected = Object.values(rawErrors)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(Boolean);

      if (collected.length) {
        return collected.join(' ');
      }
    }

    if (typeof err?.error === 'string') {
      return err.error;
    }

    if (err?.error?.title) {
      return err.error.title;
    }

    return err?.error?.message || err?.message || 'Unable to create your account. Please try again.';
  }
}
