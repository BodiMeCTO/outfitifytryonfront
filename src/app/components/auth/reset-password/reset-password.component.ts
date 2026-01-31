import { ChangeDetectionStrategy, Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';

import { AuthService } from '../../../services/auth.service';

type ResetState = 'form' | 'loading' | 'success' | 'error' | 'invalid_link';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  private email: string | null = null;
  private token: string | null = null;

  state: ResetState = 'form';
  errorMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;

  static readonly passwordsMatch: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  };

  readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: ResetPasswordComponent.passwordsMatch }
  );

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email');
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.email || !this.token) {
      this.state = 'invalid_link';
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.state === 'loading' || !this.email || !this.token) {
      return;
    }

    const { password } = this.form.getRawValue();
    if (!password) return;

    this.state = 'loading';
    this.errorMessage = '';

    this.auth.resetPassword(this.email, this.token, password).pipe(
      finalize(() => this.cdr.markForCheck())
    ).subscribe({
      next: () => {
        this.state = 'success';
      },
      error: (err) => {
        this.state = 'error';
        this.errorMessage = err?.error?.error || 'Failed to reset password. The link may have expired.';
      }
    });
  }

  goToLogin(): void {
    this.router.navigateByUrl('/auth/login');
  }

  requestNewLink(): void {
    this.router.navigateByUrl('/auth/forgot-password');
  }
}
