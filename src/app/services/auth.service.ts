import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { OutfitifyApiService } from './outfitify-api.service';
import { ForgotPasswordRequest, SignupRequest } from '../models/auth';
import { UserProfile } from '../models/user';
import { ModelProfileDto } from '../models/outfitify-api';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  readonly token$ = this.tokenSubject.asObservable();
  private readonly userSubject = new BehaviorSubject<UserProfile | null>(null);
  readonly user$ = this.userSubject.asObservable();
  private readonly emailSubject = new BehaviorSubject<string | null>(null);
  readonly email$ = this.emailSubject.asObservable();

  constructor(private readonly api: OutfitifyApiService) {
    // On app start, restore token from localStorage if it exists
    const saved = localStorage.getItem('access_token')?.trim();
    const savedEmail = localStorage.getItem('user_email')?.trim();

    // Validate token is not empty or invalid
    const isValidToken = saved && saved.length > 0 && saved !== 'null' && saved !== 'undefined';
    const isValidEmail = savedEmail && savedEmail.length > 0 && savedEmail !== 'null' && savedEmail !== 'undefined';

    if (isValidToken && isValidEmail) {
      this.tokenSubject.next(saved);
      this.emailSubject.next(savedEmail);
      this.refreshCurrentUser().subscribe({
        error: (err) => console.error('Unable to load current user', err)
      });
    } else if (isValidToken && !isValidEmail) {
      // No stored email means we cannot call the email-based profile endpoint; force re-login.
      console.warn('Access token found without stored email. Clearing session and requiring login.');
      this.logout();
    } else {
      // No valid token - ensure clean state
      this.logout();
    }
  }

  /**
   * Call the backend /Token endpoint using password grant.
   */
  login(username: string, password: string): Observable<UserProfile | null> {
    // Clear any previous session state before logging in
    const previousEmail = this.emailSubject.value;
    if (previousEmail && previousEmail !== username) {
      console.log(`[Auth] Switching user from ${previousEmail} to ${username}`);
      // Clear previous state to prevent stale data
      this.tokenSubject.next(null);
      this.userSubject.next(null);
      this.emailSubject.next(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_email');
    }

    const payload = {
      grant_type: 'password',
      username,
      password
      // Add scopes if your OpenIddict setup requires them:
      // scope: 'openid profile email'
    };

    return this.api.exchangePassword(payload).pipe(
      tap((res) => {
        // Store token and email for the new user
        console.log(`[Auth] Login successful for ${username}`);
        this.setToken(res.access_token);
        this.setEmail(username);
      }),
      switchMap(() => this.refreshCurrentUser())
    );
  }

  signup(payload: SignupRequest): Observable<void> {
    if (payload.email) {
      this.setEmail(payload.email);
    }
    return this.api.register(payload);
  }

  requestPasswordReset(payload: ForgotPasswordRequest): Observable<void> {
    return this.api.requestPasswordReset(payload);
  }

  logout(): void {
    this.tokenSubject.next(null);
    this.userSubject.next(null);
    this.emailSubject.next(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
  }

  getToken(): string | null {
    const token = this.tokenSubject.value ?? localStorage.getItem('access_token');
    // Return null if token is empty, whitespace-only, or the literal string 'null'/'undefined'
    if (!token || !token.trim() || token === 'null' || token === 'undefined') {
      return null;
    }
    return token.trim();
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    return !!token && token.length > 0;
  }

  refreshCurrentUser(): Observable<UserProfile | null> {
    const bearer = this.getToken();
    const email = this.emailSubject.value ?? localStorage.getItem('user_email');

    if (!bearer) {
      this.userSubject.next(null);
      return of(null);
    }

    if (!environment.apiBaseUrl?.trim()) {
      console.warn(
        'Skipping current user refresh because no OutfitifyAPI base URL is configured.'
      );
      this.userSubject.next(null);
      return of(null);
    }

    if (!email) {
      console.error('No stored email available; cannot load user profile');
      this.userSubject.next(null);
      return of(null);
    }

    return this.api.getUserModelProfileByEmail(email).pipe(
      map((dto) => this.mapUserProfileDto(dto, email)),
      tap((user) => this.userSubject.next(user)),
      catchError((err) => {
        console.error('Failed to load current user profile', err);
        this.userSubject.next(null);
        return of(null);
      })
    );
  }

  private setToken(token: string): void {
    this.tokenSubject.next(token);
    localStorage.setItem('access_token', token);
  }

  private setEmail(email: string): void {
    this.emailSubject.next(email);
    localStorage.setItem('user_email', email);
  }

  private mapUserProfileDto(dto: ModelProfileDto, emailFromToken: string | null): UserProfile {
    return {
      id: dto.userId,
      email: emailFromToken ?? null,
      name: dto.name ?? emailFromToken ?? null,
      clientId: dto.clientId ?? null,
      modelId: dto.modelId ?? null,
      ethnicity: dto.ethnicity ?? null,
      bodyType: dto.bodyType ?? null,
      skinTone: dto.skinTone ?? null,
      gender: dto.gender ?? null,
      isActive: dto.isActive ?? null,
      // Note: modelImageId is NOT the same as modelId
      // modelId = user's Model profile entity (ethnicity, body type, etc.)
      // modelImageId = an uploaded ModelImage for virtual try-on
      // Backend doesn't return modelImageId in profile - user must select from their gallery
      modelImageId: null,
      poseOptionId: null,
      backgroundOptionId: null
    };
  }
}
