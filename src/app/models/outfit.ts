// frontend/src/app/models/outfit.ts

// -----------------------
// Frontend garment models
// -----------------------

export type GarmentCategory =
  | 'tops'
  | 'bottoms'
  | 'full-body'
  | 'jackets'
  | 'accessories';

export interface Garment {
  id: string;
  name: string;
  description: string;
  category: GarmentCategory;
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

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  createdAt: Date;
  status: 'processing' | 'ready';
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
    top: Garment | null;
    bottom: Garment | null;
    fullBody: Garment | null;
    jacket: Garment | null;
    accessories: Garment | null;
  };
  sizes: {
    top: string | null;
    bottom: string | null;
    fullBody: string | null;
    jacket: string | null;
    accessories: string | null;
  };
}

export type OutfitRequestSnapshot = Readonly<OutfitRequest>;

export interface GarmentResponse {
  id: string;
  name: string;
  description: string;
  category: GarmentCategory;
  imageUrl?: string;
  image?: string;
  sizes?: string[];
}

// -----------------------
// Backend DTOs (match C#)
// -----------------------

export interface OutfitGarmentInstance {
  garmentInstanceEntityId: string;
  outfitRequestId?: string;
}

export interface OutfitImage {
  id: string;
  assetUrl: string;
  createdAtUtc?: string | null;
}

export interface OutfitDto {
  id: string;
  garmentInstanceIds: string[];
  modelImageId: string;
  backgroundOptionId: string;
  creditCost?: number | null;
  status?: string | null;
  createdAtUtc?: string | null;
  completedAtUtc?: string | null;
  outfitImages?: OutfitImage[] | null;
}

export interface CreateOutfitDto {
  garmentInstanceIds: string[];
  modelImageId: string;
  poseOptionId: string;
  backgroundOptionId: string;
  garmentInstances?: OutfitGarmentInstance[] | null;
}

export type CreateOutfitResponse = OutfitDto;
