export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope?: string;
}

export interface ModelProfileDto {
  userId: string;
  clientId: string | null;
  modelId: string | null;
  name: string | null;
  ethnicity: string | null;
  bodyType: string | null;
  skinTone: string | null;
  gender: string | null;
  isActive: boolean | null;
}

export interface CatalogueOption {
  id: string;
  name: string;
  thumbnailUrl?: string;
  description?: string;
}

export interface GarmentCategoryDto {
  garmentCategoryEntityId?: number;
  group?: string | null;
  category?: string | null;
  gender?: string | null;
  displayOrder?: number | null;
}

export interface GarmentDto {
  id: string;
  name: string;
  description?: string | null;
  category: 'tops' | 'bottoms' | 'full-body' | 'jackets' | 'accessories';
  imageUrl?: string | null;
  sizes: string[];
}

export interface GarmentImageDto {
  id: string;
  imageUrl?: string | null;
  garmentCategoryEntityId?: number | null;
  name?: string | null;
}


export interface ProductImageDto {
  id: string;
  imageUrl: string;
  createdAt?: string;
}

export interface OutfitRequestDto {
  id: string;
  status: 'processing' | 'ready' | 'failed' | 'completed';
  createdAt?: string;
  imageUrl?: string;
  image?: string;
  url?: string;
}

export interface CreateOutfitRequest {
  garments: {
    top: string | null;
    bottom: string | null;
    fullBody: string | null;
    jacket: string | null;
    accessories: string | null;
  };
  sizes: {
    top: string | null;
    bottom: string | null;
    fullBody: string | null;
    jacket: string | null;
    accessories: string | null;
  };
  inspirationUrl?: string;
}

export interface InventoryItemDto {
  id: string;
  outfitRequestId: string;
  imageUrl: string;
  createdAt?: string;
}

export interface CreditsBalanceDto {
  balance: number;
  currency?: string;
}

export interface CreditsLedgerEntryDto {
  id: string;
  amount: number;
  description?: string;
  createdAt?: string;
}

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'annual';
  description?: string;
}

export interface ActivateSubscriptionRequest {
  planId: string;
  annual?: boolean;
  shopifyChargeId?: string;
}

export interface ShopifyUsageRequest {
  description: string;
  amount: number;
  currency: string;
  chargeId?: string;
}

export interface ShopifyBillingCallbackRequest {
  chargeId: string;
  status: string;
  planId?: string;
}

export interface GarmentSummaryDto {
  id: string;
  name: string;
  description?: string | null;
  category: string;          // 'tops' | 'bottoms' | 'full-body' | 'jackets' | 'accessories'
  imageUrl?: string | null;
  sizes: string[];
}

export interface CreateGarmentInstanceRequest {
  garmentEntityId: string;
  sizeName: string;
}

export interface GarmentInstanceDto {
  id: string;
  garmentEntityId: string | null;
  garmentSizeEntityId: number | null;
  sizeStr?: string | null;
}
