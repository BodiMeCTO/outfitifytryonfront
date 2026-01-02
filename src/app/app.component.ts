import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { BehaviorSubject, filter, map, shareReplay, startWith, switchMap, of, catchError, interval } from 'rxjs';

import { AuthService } from './services/auth.service';
import { OutfitifyApiService } from './services/outfitify-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    AsyncPipe,
    NgIf
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly api = inject(OutfitifyApiService);

  private readonly creditsSubject = new BehaviorSubject<number | null>(null);
  readonly credits$ = this.creditsSubject.asObservable();

  readonly isHandset$ = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay({ refCount: true, bufferSize: 1 })
    );

  readonly isLoggedIn$ = this.auth.token$.pipe(map((token) => !!token));

  readonly isAuthRoute$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.startsWith('/auth'))
  );

  readonly links = [
    { path: '/user-image-upload', label: '1. User image' },
    { path: '/garment-library', label: '2. Garments' },
    { path: '/size-and-submit', label: '3. Size & Submit' },
    { path: '/generated-gallery', label: '4. Gallery' }
  ];

  ngOnInit(): void {
    // Load credits when logged in and refresh periodically
    this.isLoggedIn$.pipe(
      switchMap(loggedIn => {
        if (!loggedIn) {
          return of(null);
        }
        // Initial load + refresh every 30 seconds
        return interval(30000).pipe(
          startWith(0),
          switchMap(() => this.api.getCreditsBalance().pipe(
            map(balance => balance.balance),
            catchError(() => of(null))
          ))
        );
      })
    ).subscribe(credits => this.creditsSubject.next(credits));

    // Also refresh on navigation
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => this.refreshCredits());
  }

  refreshCredits(): void {
    this.api.getCreditsBalance().pipe(
      catchError(() => of({ balance: 0, reservedCredits: 0 }))
    ).subscribe(balance => this.creditsSubject.next(balance.balance));
  }

  onLogout(): void {
    this.creditsSubject.next(null);
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
