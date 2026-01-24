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
  prompt?: string | null;
  isTemplate?: boolean;
}

export interface BackgroundImageDto {
  backgroundImageId: string;
  name: string;
  imageUrl?: string | null;
  prompt?: string | null;
  environmentType?: string | null;
  isActive?: boolean | null;
  isTemplate?: boolean | null;
  isUserUploaded?: boolean | null;
  thumbnailUrl?: string | null;
}

export interface CreateBackgroundImageDto {
  name: string;
  environmentType?: string | null;
  isActive?: boolean | null;
}

export interface UpdateBackgroundImageDto {
  name?: string | null;
  environmentType?: string | null;
  isActive?: boolean | null;
}

export interface GarmentCategoryDto {
  garmentCategoryEntityId?: number;
  garmentCategoryEntityID?: number; // Backend uses uppercase ID
  group?: string | null;
  category?: string | null;
  gender?: string | null;
  displayOrder?: number | null;
}

export interface ImagePerspectiveDto {
  id?: number;
  name?: string | null;
  Id?: number;
  Name?: string | null;
}

export interface GarmentDto {
  id: string;
  name: string;
  description?: string | null;
  category: 'tops' | 'bottoms' | 'full-body' | 'jackets' | 'footwear' | 'accessories';
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
  status: 'processing' | 'ready' | 'failed' | 'completed' | 'pending_retry' | 'permanently_failed';
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
    footwear: string | null;
    accessories: string | null;
  };
  sizes: {
    top: string | null;
    bottom: string | null;
    fullBody: string | null;
    jacket: string | null;
    footwear: string | null;
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
  type: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  createdAt?: string;
  outfitDetails?: OutfitDetailsDto;
}

export interface OutfitDetailsDto {
  outfitId: string;
  modelImageUrl?: string | null;
  poseName?: string | null;
  backgroundName?: string | null;
  aspectRatio?: string | null;
  outfitImageUrl?: string | null;
  garments: OutfitGarmentInfoDto[];
}

export interface OutfitGarmentInfoDto {
  name?: string | null;
  imageUrl?: string | null;
  category?: string | null;
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
  category: string;          // 'tops' | 'bottoms' | 'full-body' | 'jackets' | 'footwear' | 'accessories'
  imageUrl?: string | null;
  sizes: string[];
  archivedAtUtc?: string | null;
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

// --- Outfit Image Edit ---
export interface FilterSettingsDto {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  sharpness?: number;
}

export interface UpscaleSettingsDto {
  scale?: '2x' | '4x';
  denoise?: number;
}

export interface EditOutfitImageDto {
  filterPreset?: string;
  customFilters?: FilterSettingsDto;
  upscale?: UpscaleSettingsDto;
}

export interface EditOutfitImageResponseDto {
  newOutfitImageId: string;
  assetUrl: string;
  resolution: string;
  creditCost: number;
}

// --- Tutorial State ---
export interface TutorialStateDto {
  tutorialCompleted: boolean;
  tutorialStep: string | null;
  hasCreatedFirstOutfit: boolean;
}

export interface UpdateTutorialStateDto {
  tutorialCompleted?: boolean;
  tutorialStep?: string | null;
  hasCreatedFirstOutfit?: boolean;
}
