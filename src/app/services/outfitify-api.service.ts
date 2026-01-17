import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ActivateSubscriptionRequest,
  CatalogueOption,
  CreditsBalanceDto,
  CreditsLedgerEntryDto,
  BackgroundImageDto,
  ImagePerspectiveDto,
  InventoryItemDto,
  GarmentSummaryDto,
  GarmentCategoryDto,
  ShopifyBillingCallbackRequest,
  ShopifyUsageRequest,
  SubscriptionPlanDto,
  TokenResponse,
  ModelProfileDto,
  GarmentImageDto,
  UpdateBackgroundImageDto,
  EditOutfitImageDto,
  EditOutfitImageResponseDto
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

  listBackgroundImages(): Observable<BackgroundImageDto[]> {
    return this.http.get<BackgroundImageDto[]>(this.buildUrl('/api/background-images'));
  }

  getBackgroundImage(id: string): Observable<BackgroundImageDto> {
    return this.http.get<BackgroundImageDto>(this.buildUrl(`/api/backgrounds/${id}`));
  }

  updateBackgroundImage(
    id: string,
    payload: UpdateBackgroundImageDto
  ): Observable<BackgroundImageDto> {
    return this.http.put<BackgroundImageDto>(this.buildUrl(`/api/background-images/${id}`), payload);
  }

  deleteBackgroundImage(id: string): Observable<void> {
    return this.http.delete<void>(this.buildUrl(`/api/background-images/${id}`));
  }

  listAssets(): Observable<CatalogueOption[]> {
    return this.http.get<CatalogueOption[]>(this.buildUrl('/api/assets'));
  }

  // --- Garments ---
  listGarments(includeArchived: boolean = false): Observable<GarmentSummaryDto[]> {
    const url = includeArchived ? '/api/garments?includeArchived=true' : '/api/garments';
    return this.http.get<GarmentSummaryDto[]>(this.buildUrl(url));
  }

  archiveGarment(id: string): Observable<void> {
    return this.http.post<void>(this.buildUrl(`/api/garments/${id}/archive`), {});
  }

  unarchiveGarment(id: string): Observable<void> {
    return this.http.post<void>(this.buildUrl(`/api/garments/${id}/unarchive`), {});
  }

  listGarmentImagePerspectives(): Observable<ImagePerspectiveDto[]> {
    return this.http.get<ImagePerspectiveDto[]>(this.buildUrl('/api/garments/image-perspectives'));
  }

  listGarmentCategories(): Observable<GarmentCategoryDto[]> {
    return this.http.get<GarmentCategoryDto[]>(this.buildUrl('/api/garments/categories'));
  }

  uploadGarmentImage(formData: FormData): Observable<GarmentImageDto> {
    return this.http.post<GarmentImageDto>(this.buildUrl('/api/garment-images/upload'), formData);
  }

  // --- Outfits ---
  listOutfitRequests(includeArchived: boolean = false): Observable<OutfitDto[]> {
    const url = includeArchived ? '/api/outfits?includeArchived=true' : '/api/outfits';
    return this.http.get<OutfitDto[]>(this.buildUrl(url));
  }

  getOutfitRequest(id: string): Observable<OutfitDto> {
    return this.http.get<OutfitDto>(this.buildUrl(`/api/outfits/${id}`));
  }

  createOutfitRequest(request: CreateOutfitDto): Observable<OutfitDto> {
    return this.http.post<OutfitDto>(this.buildUrl('/api/outfits'), request);
  }

  archiveOutfit(id: string): Observable<void> {
    return this.http.patch<void>(this.buildUrl(`/api/outfits/${id}/archive`), {});
  }

  unarchiveOutfit(id: string): Observable<void> {
    return this.http.patch<void>(this.buildUrl(`/api/outfits/${id}/unarchive`), {});
  }

  // --- User uploaded model images ---
  listModelImages(isBackgroundVariant?: boolean, includeArchived: boolean = false): Observable<ModelImageDto[]> {
    let url = '/api/model-images';
    const params = [];
    if (isBackgroundVariant !== undefined) {
      params.push(`isBackgroundVariant=${isBackgroundVariant}`);
    }
    if (includeArchived) {
      params.push('includeArchived=true');
    }
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    return this.http.get<ModelImageDto[]>(this.buildUrl(url));
  }

  archiveModelImage(id: string): Observable<void> {
    return this.http.post<void>(this.buildUrl(`/api/model-images/${id}/archive`), {});
  }

  unarchiveModelImage(id: string): Observable<void> {
    return this.http.post<void>(this.buildUrl(`/api/model-images/${id}/unarchive`), {});
  }

  uploadModelImage(formData: FormData): Observable<ModelImageDto> {
    return this.http.post<ModelImageDto>(this.buildUrl('/api/model-images/upload'), formData);
  }

  createModelImageWithBackground(payload: CreateModelImageWithBackgroundDto): Observable<CreateModelImageWithBackgroundResponse> {
    return this.http.post<CreateModelImageWithBackgroundResponse>(
      this.buildUrl('/api/model-images/create-with-background'),
      payload
    );
  }

  // --- Outfit Image Edit ---
  editOutfitImage(outfitImageId: string, payload: EditOutfitImageDto): Observable<EditOutfitImageResponseDto> {
    return this.http.post<EditOutfitImageResponseDto>(
      this.buildUrl(`/api/outfit-images/${outfitImageId}/edit`),
      payload
    );
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

  grantCredits(amount: number, description?: string): Observable<CreditsBalanceDto> {
    return this.http.post<CreditsBalanceDto>(this.buildUrl('/api/credits/grant'), { amount, description });
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

  // --- Clothing Segmentation ---
  analyzeClothingSegmentation(file: File): Observable<ClothingSegmentationResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ClothingSegmentationResponse>(
      this.buildUrl('/api/clothing-segmentation/analyze'),
      formData
    );
  }

  extractGarmentsFromSegmentation(
    file: File,
    extractions: GarmentExtractionItem[]
  ): Observable<ExtractGarmentsResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('extractions', JSON.stringify(extractions));
    return this.http.post<ExtractGarmentsResponse>(
      this.buildUrl('/api/clothing-segmentation/extract'),
      formData
    );
  }

  // --- Smart Garment Analysis ---
  analyzeGarmentImage(file: File): Observable<GarmentAnalysisResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<GarmentAnalysisResponse>(
      this.buildUrl('/api/garment-analysis/analyze'),
      formData
    );
  }

  saveAnalyzedGarment(request: SaveGarmentRequest): Observable<SaveGarmentResponse> {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('imageType', request.imageType);
    if (request.garmentName) formData.append('garmentName', request.garmentName);
    if (request.garmentGroup) formData.append('garmentGroup', request.garmentGroup);
    if (request.categoryId) formData.append('categoryId', request.categoryId.toString());
    if (request.extractions) formData.append('extractions', JSON.stringify(request.extractions));
    return this.http.post<SaveGarmentResponse>(
      this.buildUrl('/api/garment-analysis/save'),
      formData
    );
  }

  private apiRoot(): string {
    return this.apiBaseUrl.endsWith('/api')
      ? this.apiBaseUrl.replace(/\/api$/, '')
      : this.apiBaseUrl;
  }
}

// Clothing segmentation types
export interface ClothingSegmentationResponse {
  success: boolean;
  errorMessage?: string;
  detectedRegions: DetectedClothingRegion[];
  previewImageBase64?: string;
}

export interface DetectedClothingRegion {
  region: string;
  displayName: string;
  suggestedGroup: string;
  confidence?: number;
  boundingBox?: number[];
}

export interface GarmentExtractionItem {
  region: string;
  garmentGroup: string;
  categoryId?: number;
  name?: string;
}

export interface ExtractGarmentsResponse {
  success: boolean;
  errorMessage?: string;
  extractedGarments: ExtractedGarment[];
}

export interface ExtractedGarment {
  region: string;
  garmentGroup: string;
  name?: string;
  imageUrl: string;
  garmentEntityId: string;
}

// Garment analysis types
export interface GarmentAnalysisResponse {
  success: boolean;
  detectedImageType: 'FlatLay' | 'PersonWearing' | 'Unknown';
  imageTypeConfidence: number;
  suggestedGroup?: string;
  suggestedCategory?: string;
  suggestedCategoryId?: number;
  classificationConfidence: number;
  alternativeClassifications: GarmentClassification[];
  detectedRegions?: DetectedClothingRegion[];
  previewImageBase64?: string;
  errorMessage?: string;
}

export interface GarmentClassification {
  label: string;
  group: string;
  confidence: number;
}

export interface SaveGarmentRequest {
  file: File;
  imageType: 'FlatLay' | 'PersonWearing';
  garmentName?: string;
  garmentGroup?: string;
  categoryId?: number;
  extractions?: GarmentExtractionItem[];
}

export interface SaveGarmentResponse {
  success: boolean;
  savedGarments: SavedGarment[];
  errorMessage?: string;
}

export interface SavedGarment {
  garmentId: string;
  name: string;
  imageUrl: string;
  group: string;
}

// Model image with background types
export interface CreateModelImageWithBackgroundDto {
  sourceModelImageId: string;
  backgroundPrompt?: string;
  aspectRatio?: string;
  name?: string;
  /** If true, removes background, repositions model (8% top, 10% bottom), then applies new background. */
  repositionModel?: boolean;
}

export interface CreateModelImageWithBackgroundResponse {
  modelImageId: string;
  imageUrl: string;
  name: string;
  isBackgroundVariant: boolean;
}
