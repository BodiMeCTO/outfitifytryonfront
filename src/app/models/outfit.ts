// frontend/src/app/models/outfit.ts

// -----------------------
// Frontend garment models
// -----------------------

export type GarmentGroup =
  | 'tops'
  | 'bottoms'
  | 'full-body'
  | 'jackets'
  | 'accessories';

export interface Garment {
  id: string;
  name: string;
  description: string;
  group: GarmentGroup;
  image: string;
  sizes?: string[];
}

// -----------------------
// Inspiration / upload flow
// -----------------------

export interface SelectedInspiration {
  file?: File;
  previewUrl: string;
  source: 'upload' | 'generated';
  remoteUrl?: string;
  id?: string;
  isBackgroundVariant?: boolean;
  name?: string;
}

export interface UploadedInspirationResponse {
  id?: string;
  imageUrl?: string;
  url?: string;
  image?: string;
  inspirationUrl?: string;
  downloadUrl?: string;
}

// -----------------------
// Gallery models (old shape)
// -----------------------

// Represents a single outfit image (original or enhanced variant)
export interface OutfitImageVariant {
  id: string;              // OutfitImage ID
  imageUrl: string;
  editType?: string | null;  // 'filtered', 'upscaled', 'filtered_upscaled', or null for original
  createdAt: Date;
}

export interface GeneratedImage {
  id: string;              // Outfit ID
  outfitImageId?: string;  // Primary OutfitImage ID (for edit operations)
  imageUrl: string;
  createdAt: Date;
  status: 'processing' | 'ready';
  variants?: OutfitImageVariant[];  // All images for this outfit (original + enhanced)
  variantCount?: number;   // Quick count for badge display
}

export interface GeneratedImageResponse {
  id: string;
  imageUrl?: string;
  image?: string;
  url?: string;
  createdAt?: string;
  status?: 'processing' | 'ready' | 'completed' | 'failed';
}

// -----------------------
// Outfit-building state (frontend)
// -----------------------

export interface OutfitRequest {
  inspiration: SelectedInspiration | null;
  garments: {
    top: Garment[];
    bottom: Garment[];
    fullBody: Garment[];
    jacket: Garment[];
    accessories: Garment[];
  };
  sizes: {
    top: Record<string, string | null>; // garmentId -> size
    bottom: Record<string, string | null>;
    fullBody: Record<string, string | null>;
    jacket: Record<string, string | null>;
    accessories: Record<string, string | null>;
  };
}

export type OutfitRequestSnapshot = Readonly<OutfitRequest>;

export interface GarmentResponse {
  id: string;
  name: string;
  description: string;
  group: GarmentGroup;
  imageUrl?: string;
  image?: string;
  sizes?: string[];
}

// -----------------------
// Backend DTOs (match C#)
// -----------------------

export interface OutfitGarment {
  garmentEntityId: string;
  garmentSizeEntityId?: number | null;
}

export interface OutfitImage {
  id: string;
  assetUrl: string;
  createdAtUtc?: string | null;
  editType?: string | null;  // 'filtered', 'upscaled', 'filtered_upscaled', or null for original
}

export interface OutfitDto {
  id: string;
  modelImageId: string;
  backgroundOptionId: string | null;
  aspectRatio?: string | null;
  generatedModelImageId?: string | null;
  creditCost?: number | null;
  status?: string | null;
  createdAtUtc?: string | null;
  completedAtUtc?: string | null;
  outfitImages?: OutfitImage[] | null;
}

export interface CreateOutfitDto {
  modelImageId: string;
  poseOptionId: string;
  backgroundOptionId: string | null;
  customBackgroundPrompt?: string | null;
  aspectRatio?: string | null;
  outfitGarments: OutfitGarment[];
}

// Aspect ratios supported for background replacement (portrait/square only)
// Landscape ratios are not supported as they create canvases where the person is too small
export type AspectRatioOption = 'original' | '1:1' | '3:4' | '9:16';

export const ASPECT_RATIO_OPTIONS: { value: AspectRatioOption; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '1:1', label: '1:1 Square' },
  { value: '3:4', label: '3:4 Portrait' },
  { value: '9:16', label: '9:16 Story' }
];

export type CreateOutfitResponse = OutfitDto;
