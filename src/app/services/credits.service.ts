import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { OutfitifyApiService } from './outfitify-api.service';

@Injectable({
  providedIn: 'root'
})
export class CreditsService {
  private readonly api = inject(OutfitifyApiService);

  private readonly _balance$ = new BehaviorSubject<number | null>(null);

  /** Current credits balance as an observable */
  readonly balance$ = this._balance$.asObservable();

  /** Current credits balance value */
  get balance(): number | null {
    return this._balance$.value;
  }

  /** Refresh the credits balance from the API */
  refresh(): Observable<number | null> {
    return this.api.getCreditsBalance().pipe(
      map(response => response.balance),
      tap(balance => this._balance$.next(balance)),
      catchError(() => {
        this._balance$.next(null);
        return of(null);
      })
    );
  }

  /** Update the balance directly (used after granting credits) */
  setBalance(balance: number): void {
    this._balance$.next(balance);
  }

  /** Clear the balance (used on logout) */
  clear(): void {
    this._balance$.next(null);
  }
}
