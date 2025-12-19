import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Attaches OutfitifyAPI authentication headers to outbound requests that target the
 * configured API base URL. Supports both bearer tokens and Azure Functions keys
 * so deployments can opt into either authentication scheme.
 */
export const outfitifyApiInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiBaseUrl, apiFunctionsKey } = environment;

  const baseUrl = apiBaseUrl?.trim();

  if (!baseUrl || !req.url.startsWith(baseUrl)) {
    return next(req);
  }

  const headers: Record<string, string> = {};

  // Get runtime bearer token from AuthService
  const auth = inject(AuthService);
  const bearer = auth.getToken()?.trim();

  const functionsKey = apiFunctionsKey?.trim();

  if (bearer) {
    headers['Authorization'] = `Bearer ${bearer}`;
  }

  if (functionsKey) {
    headers['x-functions-key'] = functionsKey;
  }

  let updated = Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;

  if (functionsKey && !req.url.includes('code=')) {
    const separator = req.url.includes('?') ? '&' : '?';
    updated = updated.clone({
      url: `${req.url}${separator}code=${encodeURIComponent(functionsKey)}`
    });
  }

  return next(updated);
};
