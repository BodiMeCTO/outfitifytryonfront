import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { take } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { CreditsService } from '../../services/credits.service';
import { CreditsLedgerEntryDto } from '../../models/outfitify-api';

@Component({
  selector: 'app-credits',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './credits.component.html',
  styleUrls: ['./credits.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0', opacity: 0 })),
      state('expanded', style({ height: '*', opacity: 1 })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ])
  ]
})
export class CreditsComponent {
  private readonly api = inject(OutfitifyApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly creditsService = inject(CreditsService);

  readonly balance = signal<number | null>(null);
  readonly transactions = signal<CreditsLedgerEntryDto[]>([]);
  readonly isLoading = signal(true);
  readonly isGranting = signal(false);
  readonly expandedRows = new Set<string>();

  readonly displayedColumns = ['date', 'description', 'amount', 'balance'];

  constructor() {
    this.loadCredits();
  }

  goBack(): void {
    // Use location.back() to go to the previous page
    // If there's no history, fallback to gallery
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/generated-gallery']);
    }
  }

  loadCredits(): void {
    this.isLoading.set(true);

    this.api.getCreditsBalance().pipe(take(1)).subscribe({
      next: (response) => {
        this.balance.set(response.balance);
      },
      error: () => {
        this.snackBar.open('Failed to load credits balance.', 'Dismiss', { duration: 3000 });
      }
    });

    this.api.getCreditsLedger().pipe(take(1)).subscribe({
      next: (transactions) => {
        this.transactions.set(transactions);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to load transaction history.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  grantCredits(): void {
    this.isGranting.set(true);

    this.api.grantCredits(100, 'Demo credit grant').pipe(take(1)).subscribe({
      next: (response) => {
        this.balance.set(response.balance);
        this.creditsService.setBalance(response.balance);
        this.isGranting.set(false);
        this.snackBar.open('100 credits added to your account!', 'Great!', { duration: 3000 });
        // Reload transactions to show the new entry
        this.loadCredits();
      },
      error: () => {
        this.isGranting.set(false);
        this.snackBar.open('Failed to grant credits.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  toggleExpand(id: string): void {
    if (this.expandedRows.has(id)) {
      this.expandedRows.delete(id);
    } else {
      this.expandedRows.add(id);
    }
  }
}
