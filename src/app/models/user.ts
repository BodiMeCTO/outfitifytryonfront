export interface UserProfile {
  id: string;
  email?: string | null;
  name?: string | null;
  clientId?: string | null;
  modelId?: string | null;
  ethnicity?: string | null;
  bodyType?: string | null;
  skinTone?: string | null;
  gender?: string | null;
  isActive?: boolean | null;
  modelImageId?: string | null;
  poseOptionId?: string | null;
  backgroundOptionId?: string | null;
}

