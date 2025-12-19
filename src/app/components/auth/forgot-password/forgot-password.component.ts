import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
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
    MatProgressSpinnerModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  loading = false;
  success = false;
  error: string | null = null;

  onSubmit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    const { email } = this.form.getRawValue();

    if (!email) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.auth.requestPasswordReset({ email }).subscribe({
      next: () => {
        this.success = true;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'We could not process your request right now. Please try again.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }
}
