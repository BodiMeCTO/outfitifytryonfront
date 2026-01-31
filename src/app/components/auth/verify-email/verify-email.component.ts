import { ChangeDetectionStrategy, Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';

import { AuthService } from '../../../services/auth.service';

type VerificationState = 'loading' | 'success' | 'already_verified' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  state: VerificationState = 'loading';
  errorMessage = '';

  ngOnInit(): void {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!userId || !token) {
      this.state = 'error';
      this.errorMessage = 'Invalid verification link. Please check your email and try again.';
      return;
    }

    this.verifyEmail(userId, token);
  }

  private verifyEmail(userId: string, token: string): void {
    this.auth.verifyEmail(userId, token).pipe(
      finalize(() => this.cdr.markForCheck())
    ).subscribe({
      next: (result) => {
        if (result.alreadyVerified) {
          this.state = 'already_verified';
        } else if (result.verified) {
          this.state = 'success';
        } else {
          this.state = 'error';
          this.errorMessage = result.message || 'Verification failed.';
        }
      },
      error: (err) => {
        this.state = 'error';
        this.errorMessage = err?.error?.error || 'Invalid or expired verification link. Please request a new one.';
      }
    });
  }

  goToLogin(): void {
    this.router.navigateByUrl('/auth/login');
  }
}
