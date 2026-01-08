import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, map, startWith, switchMap, interval } from 'rxjs';
import { take } from 'rxjs/operators';

import { AuthService } from './services/auth.service';
import { CreditsService } from './services/credits.service';
import { LuxeDrawerComponent, DrawerNavItem } from './components/shared/luxe-drawer/luxe-drawer.component';
import { BottomNavComponent, BottomNavItem } from './components/shared/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    AsyncPipe,
    NgIf,
    LuxeDrawerComponent,
    BottomNavComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly creditsService = inject(CreditsService);

  readonly credits$ = this.creditsService.balance$;
  readonly isDrawerOpen = signal(false);

  readonly isLoggedIn$ = this.auth.token$.pipe(map((token) => !!token));

  readonly isAuthRoute$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.startsWith('/auth'))
  );

  readonly navItems: DrawerNavItem[] = [
    { label: 'Studio', route: '/studio', icon: 'auto_awesome' },
    { label: 'Gallery', route: '/generated-gallery', icon: 'collections' },
    { label: 'Credits', route: '/credits', icon: 'toll' }
  ];

  readonly bottomNavItems: BottomNavItem[] = [
    { label: 'Studio', route: '/studio', icon: 'auto_awesome', activeIcon: 'auto_awesome' },
    { label: 'Gallery', route: '/generated-gallery', icon: 'collections', activeIcon: 'collections' },
    { label: 'Credits', route: '/credits', icon: 'toll', activeIcon: 'toll' }
  ];

  ngOnInit(): void {
    // Load credits when logged in and refresh periodically
    this.isLoggedIn$.pipe(
      switchMap(loggedIn => {
        if (!loggedIn) {
          this.creditsService.clear();
          return interval(0).pipe(take(0)); // Empty observable
        }
        // Initial load + refresh every 60 seconds
        return interval(60000).pipe(
          startWith(0),
          switchMap(() => this.creditsService.refresh())
        );
      })
    ).subscribe();

    // Also refresh on navigation
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => this.creditsService.refresh().pipe(take(1)).subscribe());
  }

  toggleDrawer(): void {
    this.isDrawerOpen.update(v => !v);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  onLogout(): void {
    this.creditsService.clear();
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
