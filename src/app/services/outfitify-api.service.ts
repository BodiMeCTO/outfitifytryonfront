import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ActivateSubscriptionRequest,
  CatalogueOption,
  CreditsBalanceDto,
  CreditsLedgerEntryDto,
  InventoryItemDto,
  GarmentSummaryDto,
  ShopifyBillingCallbackRequest,
  ShopifyUsageRequest,
  SubscriptionPlanDto,
  TokenResponse,
  CreateGarmentInstanceRequest,
  GarmentInstanceDto,
  ModelProfileDto
} from '../models/outfitify-api';
import { CreateOutfitDto, OutfitDto } from '../models/outfit';
import { CreateModelImageDto, ModelImageDto } from './outfit.service';
import { ForgotPasswordRequest, SignupRequest } from '../models/auth';

@Injectable({ providedIn: 'root' })
export class OutfitifyApiService {
  private readonly apiBaseUrl = environment.apiBaseUrl?.replace(/\/+$/, '') ?? '';

  constructor(private readonly http: HttpClient) {}

  // --- Auth ---
  exchangePassword(payload: Record<string, string>): Observable<TokenResponse> {
    const url = `${this.apiRoot()}/token`;
    return this.http.post<TokenResponse>(url, new URLSearchParams(payload as any), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  }

  register(payload: SignupRequest): Observable<void> {
    return this.http.post<void>(this.buildUrl('/api/users/register'), payload);
  }

  requestPasswordReset(payload: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(this.buildUrl('/api/auth/forgot-password'), payload);
  }

  getUserModelProfileByEmail(email: string): Observable<ModelProfileDto> {
    const encodedEmail = encodeURIComponent(email);
    return this.http.get<ModelProfileDto>(this.buildUrl(`/api/users/${encodedEmail}/model-profile`));
  }

  // --- Catalogue ---
  listModels(): Observable<CatalogueOption[]> {
    return this.http.get<CatalogueOption[]>(this.buildUrl('/api/models'));
  }

  listPoses(): Observable<CatalogueOption[]> {
    return this.http.get<CatalogueOption[]>(this.buildUrl('/api/poses'));
  }

  listBackgrounds(): Observable<CatalogueOption[]> {
    return this.http.get<CatalogueOption[]>(this.buildUrl('/api/backgrounds'));
  }

  listAssets(): Observable<CatalogueOption[]> {
    return this.http.get<CatalogueOption[]>(this.buildUrl('/api/assets'));
  }

  // --- Garments ---
  listGarments(): Observable<GarmentSummaryDto[]> {
    return this.http.get<GarmentSummaryDto[]>(this.buildUrl('/api/products'));
  }

  // --- Garment Instances ---
  createGarmentInstance(payload: CreateGarmentInstanceRequest): Observable<GarmentInstanceDto> {
    return this.http.post<GarmentInstanceDto>(this.buildUrl('/api/product-instances'), payload);
  }

  // --- Outfits ---
  listOutfitRequests(): Observable<OutfitDto[]> {
    return this.http.get<OutfitDto[]>(this.buildUrl('/api/outfits'));
  }

  getOutfitRequest(id: string): Observable<OutfitDto> {
    return this.http.get<OutfitDto>(this.buildUrl(`/api/outfits/${id}`));
  }

  createOutfitRequest(request: CreateOutfitDto): Observable<OutfitDto> {
    return this.http.post<OutfitDto>(this.buildUrl('/api/outfits'), request);
  }

  // --- User uploaded model images ---
  listModelImages(): Observable<ModelImageDto[]> {
    return this.http.get<ModelImageDto[]>(this.buildUrl('/api/model-images'));
  }

  uploadModelImage(formData: FormData): Observable<ModelImageDto> {
    return this.http.post<ModelImageDto>(this.buildUrl('/api/model-images/upload'), formData);
  }


  // --- Inventory ---
  listInventory(): Observable<InventoryItemDto[]> {
    return this.http.get<InventoryItemDto[]>(this.buildUrl('/api/inventory'));
  }

  createInventoryItem(outfitRequestId: string): Observable<InventoryItemDto> {
    return this.http.post<InventoryItemDto>(
      this.buildUrl(`/api/inventory/${outfitRequestId}`),
      {}
    );
  }

  // --- Credits ---
  getCreditsBalance(): Observable<CreditsBalanceDto> {
    return this.http.get<CreditsBalanceDto>(this.buildUrl('/api/credits/balance'));
  }

  getCreditsLedger(): Observable<CreditsLedgerEntryDto[]> {
    return this.http.get<CreditsLedgerEntryDto[]>(this.buildUrl('/api/credits/ledger'));
  }

  // --- Subscriptions ---
  listSubscriptions(): Observable<SubscriptionPlanDto[]> {
    return this.http.get<SubscriptionPlanDto[]>(this.buildUrl('/api/subscriptions'));
  }

  activateSubscription(payload: ActivateSubscriptionRequest): Observable<void> {
    return this.http.post<void>(this.buildUrl('/api/subscriptions/activate'), payload);
  }

  // --- Shopify hooks ---
  recordShopifyUsage(payload: ShopifyUsageRequest): Observable<void> {
    return this.http.post<void>(this.buildUrl('/api/shopify/usage'), payload);
  }

  shopifyBillingCallback(payload: ShopifyBillingCallbackRequest): Observable<void> {
    return this.http.post<void>(this.buildUrl('/api/shopify/billing-callback'), payload);
  }

  // --- URL helpers ---
  private buildUrl(path: string): string {
    if (!this.apiBaseUrl) throw new Error('OutfitifyAPI base URL is not configured');

    const base =
      this.apiBaseUrl.endsWith('/api') && path.startsWith('/api')
        ? this.apiBaseUrl.replace(/\/api$/, '')
        : this.apiBaseUrl;

    return `${base}${path}`.replace(/(?<!:)\/\//g, '/');
  }

  private apiRoot(): string {
    return this.apiBaseUrl.endsWith('/api')
      ? this.apiBaseUrl.replace(/\/api$/, '')
      : this.apiBaseUrl;
  }
}
