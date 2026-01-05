import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = false;
  error: string | null = null;
  hidePassword = true;

  onSubmit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    const { email, password } = this.form.getRawValue();

    if (!email || !password) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/studio';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.error = this.extractErrorMessage(err);
        this.loading = false;
        this.cdr.markForCheck();
      },
      complete: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private extractErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;

    const errorResponse: any = err && typeof err === 'object' ? err : null;

    const apiDescription = errorResponse?.error?.error_description || errorResponse?.error_description;
    const apiMessage = errorResponse?.error?.message || errorResponse?.message;

    if (apiDescription) return apiDescription;
    if (apiMessage) return apiMessage;

    return 'Unable to sign in. Please check your credentials and try again.';
  }
}
