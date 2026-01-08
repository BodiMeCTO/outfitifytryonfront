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
  /** Indicates this is a preloaded template model image */
  isTemplate?: boolean;
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
  /** Pose change prompt from preset selection */
  posePrompt?: string | null;
  outfitGarments: OutfitGarment[];
}

// -----------------------
// Pose presets
// -----------------------

export interface PosePreset {
  id: string;
  name: string;
  prompt: string;
}

export const POSE_PRESETS: PosePreset[] = [
  // Keep original
  { id: 'original', name: 'Original', prompt: '' },

  // Confident poses
  { id: 'hands-hips', name: 'Hands on Hips', prompt: 'person standing with hands on hips, confident powerful pose, looking at camera' },
  { id: 'arms-crossed', name: 'Arms Crossed', prompt: 'person standing with arms crossed, relaxed confident pose, slight smile' },
  { id: 'power-stance', name: 'Power Stance', prompt: 'person in strong power stance, feet shoulder-width apart, confident expression' },

  // Casual poses
  { id: 'one-hand-hip', name: 'One Hand on Hip', prompt: 'person standing with one hand on hip, casual relaxed pose' },
  { id: 'casual-standing', name: 'Relaxed', prompt: 'person standing casually with relaxed arms at sides, natural comfortable pose' },
  { id: 'leaning', name: 'Leaning', prompt: 'person leaning slightly to one side, casual cool pose, relaxed shoulders' },

  // Dynamic poses
  { id: 'walking', name: 'Walking', prompt: 'person walking naturally, mid-stride, looking forward, dynamic movement' },
  { id: 'turning', name: 'Turning', prompt: 'person turning to look over shoulder, elegant twist, dynamic pose' },
  { id: 'stepping', name: 'Stepping Out', prompt: 'person taking a confident step forward, dynamic movement, fashion runway style' },

  // Elegant poses
  { id: 'model-pose', name: 'Model Pose', prompt: 'professional model pose, one leg slightly forward, elegant stance, fashion editorial' },
  { id: 'looking-away', name: 'Looking Away', prompt: 'person looking away from camera, profile view, thoughtful elegant pose' },
  { id: 'hand-on-chin', name: 'Thoughtful', prompt: 'person with hand near chin, thoughtful contemplative pose, sophisticated' },
];

// Aspect ratios supported for background replacement (portrait/square only)
// Landscape ratios are not supported as they create canvases where the person is too small
export type AspectRatioOption = 'original' | '1:1' | '2:3' | '3:4' | '9:16';

export const ASPECT_RATIO_OPTIONS: { value: AspectRatioOption; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '1:1', label: '1:1 Square' },
  { value: '2:3', label: '2:3 Photo' },
  { value: '3:4', label: '3:4 Portrait' },
  { value: '9:16', label: '9:16 Story' }
];

// Preset background prompts for quick selection
export interface BackgroundPromptPreset {
  id: string;
  name: string;
  prompt: string;
  category: BackgroundCategory;
}

// Background categories - expanded for professional photography
export type BackgroundCategory =
  | 'original'
  | 'studio'
  | 'seamless'
  | 'commercial'
  | 'editorial'
  | 'outdoor'
  | 'urban'
  | 'lifestyle'
  | 'seasonal'
  | 'abstract'
  | 'luxury';

// Category metadata for UI display
export interface BackgroundCategoryInfo {
  id: BackgroundCategory;
  label: string;
  description: string;
}

export const BACKGROUND_CATEGORIES: BackgroundCategoryInfo[] = [
  { id: 'original', label: 'Original', description: 'Keep the original background' },
  { id: 'studio', label: 'Studio', description: 'Professional lighting setups' },
  { id: 'seamless', label: 'Seamless', description: 'Colored paper backdrops' },
  { id: 'commercial', label: 'Commercial', description: 'E-commerce & catalog' },
  { id: 'editorial', label: 'Editorial', description: 'Magazine & fashion' },
  { id: 'outdoor', label: 'Outdoor', description: 'Nature & landscapes' },
  { id: 'urban', label: 'Urban', description: 'City & street scenes' },
  { id: 'lifestyle', label: 'Lifestyle', description: 'Real-world settings' },
  { id: 'seasonal', label: 'Seasonal', description: 'Holiday & seasonal' },
  { id: 'abstract', label: 'Abstract', description: 'Artistic backgrounds' },
  { id: 'luxury', label: 'Luxury', description: 'High-end locations' }
];

export const BACKGROUND_PROMPT_PRESETS: BackgroundPromptPreset[] = [
  // ===========================================
  // STUDIO - Professional lighting setups
  // ===========================================
  { id: 'white-studio', name: 'White Seamless', prompt: 'professional photography studio, clean white seamless background, soft diffused studio lighting, high-end fashion photography', category: 'studio' },
  { id: 'gray-studio', name: 'Gray Seamless', prompt: 'professional photography studio, neutral gray seamless backdrop, soft diffused lighting, fashion editorial style', category: 'studio' },
  { id: 'black-studio', name: 'Black Seamless', prompt: 'professional photography studio, dramatic black background, rim lighting, high contrast fashion photography', category: 'studio' },
  { id: 'high-key', name: 'High Key', prompt: 'high key photography studio, bright white background, even soft lighting from multiple sources, overexposed clean aesthetic, commercial fashion photography', category: 'studio' },
  { id: 'low-key', name: 'Low Key', prompt: 'low key photography studio, dramatic dark background, single strong light source, deep shadows, moody dramatic fashion portrait', category: 'studio' },
  { id: 'rembrandt', name: 'Rembrandt Light', prompt: 'photography studio with Rembrandt lighting, dramatic triangle of light on cheek, deep shadows, classic portrait style, neutral background', category: 'studio' },
  { id: 'butterfly', name: 'Butterfly Light', prompt: 'photography studio with butterfly lighting, overhead key light, glamorous Hollywood style, soft fill from below, beauty photography', category: 'studio' },
  { id: 'split-light', name: 'Split Light', prompt: 'photography studio with split lighting, half face illuminated half in shadow, dramatic artistic effect, dark background', category: 'studio' },
  { id: 'rim-light', name: 'Rim/Edge Light', prompt: 'photography studio with strong rim lighting, backlit silhouette edges, dramatic separation from background, fashion editorial', category: 'studio' },
  { id: 'clamshell', name: 'Clamshell', prompt: 'photography studio with clamshell lighting setup, beauty dish above and reflector below, soft even illumination, beauty and fashion', category: 'studio' },
  { id: 'natural-window', name: 'Window Light', prompt: 'photography studio with large window, soft natural daylight streaming in, clean white walls, editorial portrait style', category: 'studio' },
  { id: 'cyclorama', name: 'Cyclorama', prompt: 'professional photography cyclorama studio, curved infinity wall, seamless white floor-to-wall transition, even studio lighting', category: 'studio' },
  { id: 'gradient-studio', name: 'Gradient', prompt: 'photography studio, smooth gradient background transitioning from light to dark gray, professional fashion lighting', category: 'studio' },

  // ===========================================
  // SEAMLESS - Colored paper backdrops
  // ===========================================
  { id: 'seamless-white', name: 'Pure White', prompt: 'professional photography with pure white seamless paper backdrop, clean commercial look, soft even lighting', category: 'seamless' },
  { id: 'seamless-black', name: 'Super Black', prompt: 'professional photography with deep black seamless paper backdrop, dramatic lighting, high contrast', category: 'seamless' },
  { id: 'seamless-gray', name: 'Neutral Gray', prompt: 'professional photography with neutral gray seamless paper backdrop, balanced tones, versatile studio setup', category: 'seamless' },
  { id: 'seamless-charcoal', name: 'Charcoal', prompt: 'professional photography with charcoal gray seamless paper backdrop, sophisticated dark tone, studio lighting', category: 'seamless' },
  { id: 'seamless-navy', name: 'Navy Blue', prompt: 'professional photography with navy blue seamless paper backdrop, rich deep color, studio lighting', category: 'seamless' },
  { id: 'seamless-coral', name: 'Coral Pink', prompt: 'professional photography with coral pink seamless paper backdrop, warm feminine tone, soft studio lighting', category: 'seamless' },
  { id: 'seamless-sage', name: 'Sage Green', prompt: 'professional photography with sage green seamless paper backdrop, earthy natural tone, soft studio lighting', category: 'seamless' },
  { id: 'seamless-cream', name: 'Cream/Ivory', prompt: 'professional photography with cream ivory seamless paper backdrop, warm elegant tone, soft flattering light', category: 'seamless' },
  { id: 'seamless-blush', name: 'Blush Pink', prompt: 'professional photography with blush pink seamless paper backdrop, soft romantic tone, beauty lighting', category: 'seamless' },
  { id: 'seamless-terracotta', name: 'Terracotta', prompt: 'professional photography with terracotta seamless paper backdrop, warm earthy orange tone, studio lighting', category: 'seamless' },
  { id: 'seamless-dusty-blue', name: 'Dusty Blue', prompt: 'professional photography with dusty blue seamless paper backdrop, muted cool tone, soft even lighting', category: 'seamless' },
  { id: 'seamless-olive', name: 'Olive', prompt: 'professional photography with olive green seamless paper backdrop, rich earthy tone, natural studio lighting', category: 'seamless' },
  { id: 'seamless-burgundy', name: 'Burgundy', prompt: 'professional photography with burgundy seamless paper backdrop, rich deep wine color, dramatic lighting', category: 'seamless' },
  { id: 'seamless-mustard', name: 'Mustard', prompt: 'professional photography with mustard yellow seamless paper backdrop, warm vibrant tone, studio lighting', category: 'seamless' },
  { id: 'seamless-lavender', name: 'Lavender', prompt: 'professional photography with lavender seamless paper backdrop, soft purple tone, dreamy lighting', category: 'seamless' },
  { id: 'seamless-camel', name: 'Camel/Tan', prompt: 'professional photography with camel tan seamless paper backdrop, warm neutral tone, soft studio lighting', category: 'seamless' },

  // ===========================================
  // COMMERCIAL - E-commerce & catalog
  // ===========================================
  { id: 'ecommerce-white', name: 'E-commerce White', prompt: 'clean e-commerce product photography background, pure white, even shadowless lighting, commercial catalog style', category: 'commercial' },
  { id: 'ecommerce-lifestyle', name: 'Lifestyle Product', prompt: 'lifestyle e-commerce setting, minimal modern interior, natural light, product photography with context', category: 'commercial' },
  { id: 'lookbook-minimal', name: 'Lookbook Minimal', prompt: 'fashion lookbook background, clean minimal studio, soft directional lighting, catalog photography', category: 'commercial' },
  { id: 'catalog-neutral', name: 'Catalog Neutral', prompt: 'fashion catalog photography, neutral gray background, professional even lighting, commercial apparel photography', category: 'commercial' },
  { id: 'retail-store', name: 'Retail Store', prompt: 'modern retail store interior, clean displays, professional retail lighting, in-store fashion photography', category: 'commercial' },
  { id: 'showroom', name: 'Showroom', prompt: 'luxury fashion showroom, minimal elegant interior, professional lighting, high-end apparel presentation', category: 'commercial' },
  { id: 'boutique-display', name: 'Boutique Display', prompt: 'boutique store display background, curated fashion retail setting, warm ambient lighting', category: 'commercial' },
  { id: 'fitting-room', name: 'Fitting Room', prompt: 'upscale fitting room with mirrors, flattering lighting, retail fashion photography environment', category: 'commercial' },

  // ===========================================
  // EDITORIAL - Magazine & fashion
  // ===========================================
  { id: 'vogue-studio', name: 'Vogue Studio', prompt: 'high fashion Vogue-style studio, dramatic directional lighting, sophisticated minimal backdrop, editorial fashion photography', category: 'editorial' },
  { id: 'harpers-elegant', name: 'Harpers Elegant', prompt: 'elegant editorial setting, soft diffused lighting, timeless sophisticated backdrop, luxury fashion magazine style', category: 'editorial' },
  { id: 'avant-garde', name: 'Avant-Garde', prompt: 'avant-garde fashion editorial setting, bold artistic backdrop, dramatic creative lighting, experimental fashion photography', category: 'editorial' },
  { id: 'minimalist-editorial', name: 'Minimalist Editorial', prompt: 'minimalist fashion editorial, stark clean background, strong graphic shadows, high contrast magazine style', category: 'editorial' },
  { id: 'architectural', name: 'Architectural', prompt: 'architectural fashion editorial, modern building backdrop, geometric lines and shapes, editorial lighting', category: 'editorial' },
  { id: 'vintage-editorial', name: 'Vintage Editorial', prompt: 'vintage-inspired editorial setting, nostalgic backdrop, warm film-like tones, classic fashion photography', category: 'editorial' },
  { id: 'brutalist', name: 'Brutalist', prompt: 'brutalist architecture backdrop, raw concrete surfaces, strong shadows, edgy fashion editorial', category: 'editorial' },
  { id: 'art-museum', name: 'Art Museum', prompt: 'contemporary art museum setting, gallery walls, curated artwork backdrop, cultural fashion editorial', category: 'editorial' },
  { id: 'rooftop-editorial', name: 'Rooftop Editorial', prompt: 'urban rooftop editorial setting, city skyline backdrop, golden hour lighting, fashion magazine style', category: 'editorial' },
  { id: 'industrial-editorial', name: 'Industrial Chic', prompt: 'industrial warehouse editorial, exposed beams and pipes, dramatic lighting, edgy fashion photography', category: 'editorial' },

  // ===========================================
  // OUTDOOR - Nature & landscapes
  // ===========================================
  { id: 'beach-sunset', name: 'Beach Sunset', prompt: 'beautiful beach at golden hour, soft sunset light, ocean waves in background, warm romantic atmosphere', category: 'outdoor' },
  { id: 'beach-midday', name: 'Beach Bright', prompt: 'bright sunny beach, crystal clear water, white sand, vibrant daylight, summer fashion photography', category: 'outdoor' },
  { id: 'forest-path', name: 'Forest Path', prompt: 'enchanting forest path, dappled sunlight through trees, lush green foliage, natural peaceful atmosphere', category: 'outdoor' },
  { id: 'mountain-view', name: 'Mountain View', prompt: 'breathtaking mountain landscape, clear blue sky, majestic peaks in distance, natural outdoor lighting', category: 'outdoor' },
  { id: 'golden-field', name: 'Golden Field', prompt: 'golden wheat field at sunset, warm backlighting, dreamy outdoor fashion photography, pastoral beauty', category: 'outdoor' },
  { id: 'lavender-field', name: 'Lavender Field', prompt: 'purple lavender field in Provence, soft sunlight, romantic countryside, fashion photography', category: 'outdoor' },
  { id: 'garden-flowers', name: 'Flower Garden', prompt: 'beautiful flower garden, colorful blooming flowers, soft natural daylight, romantic garden setting', category: 'outdoor' },
  { id: 'tropical-paradise', name: 'Tropical', prompt: 'lush tropical paradise, palm trees, crystal blue water, warm sunlight, vacation resort atmosphere', category: 'outdoor' },
  { id: 'cherry-blossoms', name: 'Cherry Blossoms', prompt: 'dreamy cherry blossom garden, soft pink petals falling, spring sunshine, romantic Japanese garden', category: 'outdoor' },
  { id: 'desert-dunes', name: 'Desert Dunes', prompt: 'golden desert sand dunes at golden hour, warm dramatic lighting, vast open landscape, artistic fashion shoot', category: 'outdoor' },
  { id: 'autumn-park', name: 'Autumn Park', prompt: 'beautiful autumn park, golden and red fallen leaves, warm afternoon sunlight filtering through trees', category: 'outdoor' },
  { id: 'vineyard', name: 'Vineyard', prompt: 'beautiful vineyard landscape, rolling hills of grapevines, warm Tuscan sunlight, wine country atmosphere', category: 'outdoor' },
  { id: 'lake-reflection', name: 'Lake Reflection', prompt: 'serene lake with mountain reflections, calm water, soft morning light, peaceful outdoor setting', category: 'outdoor' },
  { id: 'cliffside-ocean', name: 'Cliffside Ocean', prompt: 'dramatic ocean cliffside, crashing waves below, moody coastal atmosphere, fashion editorial outdoors', category: 'outdoor' },

  // ===========================================
  // URBAN - City & street scenes
  // ===========================================
  { id: 'city-street', name: 'City Street', prompt: 'trendy urban street, modern architecture, golden hour city lighting, fashion streetwear vibe', category: 'urban' },
  { id: 'brick-wall', name: 'Brick Wall', prompt: 'textured red brick wall background, urban industrial aesthetic, soft diffused lighting', category: 'urban' },
  { id: 'neon-night', name: 'Neon Night', prompt: 'vibrant neon-lit urban night scene, colorful reflections, cyberpunk atmosphere, dramatic lighting', category: 'urban' },
  { id: 'cafe-interior', name: 'Café', prompt: 'cozy modern café interior, warm ambient lighting, stylish décor, relaxed atmosphere', category: 'urban' },
  { id: 'rooftop-city', name: 'Rooftop', prompt: 'urban rooftop terrace, city skyline panorama, golden hour lighting, sophisticated metropolitan vibe', category: 'urban' },
  { id: 'subway-station', name: 'Subway', prompt: 'stylish modern subway station, clean architectural lines, urban commuter atmosphere, editorial lighting', category: 'urban' },
  { id: 'graffiti-alley', name: 'Graffiti Alley', prompt: 'vibrant graffiti-covered urban alley, colorful street art murals, edgy creative atmosphere', category: 'urban' },
  { id: 'modern-loft', name: 'Modern Loft', prompt: 'industrial modern loft interior, exposed brick and metal beams, large windows, urban chic aesthetic', category: 'urban' },
  { id: 'parking-garage', name: 'Parking Garage', prompt: 'urban parking garage, concrete pillars, dramatic overhead lighting, edgy street fashion setting', category: 'urban' },
  { id: 'stairwell', name: 'Stairwell', prompt: 'architectural stairwell, geometric lines, dramatic shadows, urban fashion photography', category: 'urban' },
  { id: 'crosswalk', name: 'Crosswalk', prompt: 'busy city crosswalk, blurred motion, urban energy, street fashion photography', category: 'urban' },
  { id: 'times-square', name: 'Times Square', prompt: 'Times Square style urban backdrop, bright billboards and lights, bustling city atmosphere, night fashion', category: 'urban' },

  // ===========================================
  // LIFESTYLE - Real-world settings
  // ===========================================
  { id: 'modern-home', name: 'Modern Home', prompt: 'modern home interior, clean contemporary design, natural light through windows, lifestyle fashion photography', category: 'lifestyle' },
  { id: 'cozy-bedroom', name: 'Cozy Bedroom', prompt: 'cozy bedroom interior, soft natural light, comfortable aesthetic, intimate lifestyle photography', category: 'lifestyle' },
  { id: 'kitchen-bright', name: 'Bright Kitchen', prompt: 'bright modern kitchen, white cabinets, natural light, lifestyle domestic setting, casual fashion', category: 'lifestyle' },
  { id: 'living-room', name: 'Living Room', prompt: 'stylish living room interior, comfortable furniture, natural daylight, lifestyle at-home fashion', category: 'lifestyle' },
  { id: 'office-workspace', name: 'Office Space', prompt: 'modern office workspace, clean desk setup, professional environment, workwear fashion photography', category: 'lifestyle' },
  { id: 'gym-fitness', name: 'Gym/Fitness', prompt: 'modern gym interior, fitness equipment, energetic atmosphere, athletic wear photography', category: 'lifestyle' },
  { id: 'yoga-studio', name: 'Yoga Studio', prompt: 'serene yoga studio, natural wood floors, soft lighting, wellness lifestyle photography', category: 'lifestyle' },
  { id: 'coffee-shop', name: 'Coffee Shop', prompt: 'trendy coffee shop interior, rustic modern design, warm ambient lighting, casual lifestyle', category: 'lifestyle' },
  { id: 'restaurant-bar', name: 'Restaurant/Bar', prompt: 'upscale restaurant or bar interior, moody ambient lighting, evening dining atmosphere', category: 'lifestyle' },
  { id: 'hotel-room', name: 'Hotel Room', prompt: 'luxury hotel room interior, elegant bedding, city view window, travel lifestyle fashion', category: 'lifestyle' },
  { id: 'pool-deck', name: 'Pool Deck', prompt: 'resort pool deck, lounge chairs, blue water, sunny vacation lifestyle, swimwear photography', category: 'lifestyle' },
  { id: 'balcony-view', name: 'Balcony', prompt: 'apartment balcony with city view, golden hour light, urban lifestyle fashion photography', category: 'lifestyle' },

  // ===========================================
  // SEASONAL - Holiday & seasonal
  // ===========================================
  { id: 'christmas-cozy', name: 'Christmas Cozy', prompt: 'cozy Christmas interior, decorated tree, warm string lights, festive holiday atmosphere, winter fashion', category: 'seasonal' },
  { id: 'christmas-elegant', name: 'Christmas Elegant', prompt: 'elegant Christmas setting, sophisticated decorations, champagne gold tones, luxury holiday fashion', category: 'seasonal' },
  { id: 'winter-snow', name: 'Winter Snow', prompt: 'beautiful winter snow scene, fresh white snow, soft winter light, cold weather fashion photography', category: 'seasonal' },
  { id: 'spring-garden', name: 'Spring Garden', prompt: 'blooming spring garden, fresh flowers, soft sunlight, renewal and fresh beginnings, spring fashion', category: 'seasonal' },
  { id: 'summer-beach', name: 'Summer Beach', prompt: 'perfect summer beach day, bright sunshine, blue sky, vacation vibes, summer fashion photography', category: 'seasonal' },
  { id: 'autumn-foliage', name: 'Autumn Foliage', prompt: 'stunning autumn foliage, red and gold leaves, warm afternoon light, fall fashion photography', category: 'seasonal' },
  { id: 'valentines', name: 'Valentines', prompt: 'romantic Valentines setting, red roses, soft pink tones, love and romance atmosphere, date night fashion', category: 'seasonal' },
  { id: 'halloween-moody', name: 'Halloween Moody', prompt: 'moody Halloween atmosphere, dramatic shadows, orange and black tones, mysterious spooky aesthetic', category: 'seasonal' },
  { id: 'new-years-eve', name: 'New Years Eve', prompt: 'glamorous New Years Eve setting, sparkling decorations, champagne celebration, party fashion photography', category: 'seasonal' },
  { id: 'spring-rain', name: 'Spring Rain', prompt: 'soft spring rain, city streets glistening, moody atmospheric lighting, rainy day fashion', category: 'seasonal' },
  { id: 'summer-festival', name: 'Summer Festival', prompt: 'summer music festival atmosphere, colorful decorations, sunny outdoor vibes, festival fashion', category: 'seasonal' },
  { id: 'cozy-fall', name: 'Cozy Fall', prompt: 'cozy fall interior, warm blankets, pumpkins, candles, autumn comfort, fall fashion photography', category: 'seasonal' },

  // ===========================================
  // ABSTRACT - Artistic backgrounds
  // ===========================================
  { id: 'bokeh-lights', name: 'Bokeh Lights', prompt: 'dreamy bokeh background, soft blurred colorful lights, ethereal magical atmosphere', category: 'abstract' },
  { id: 'watercolor', name: 'Watercolor', prompt: 'artistic watercolor wash background, soft pastel colors blending together, artistic fashion editorial', category: 'abstract' },
  { id: 'marble-texture', name: 'Marble', prompt: 'elegant white marble texture background, luxury fashion aesthetic, clean sophisticated look', category: 'abstract' },
  { id: 'gradient-pastel', name: 'Pastel Gradient', prompt: 'smooth pastel gradient background, soft pink and blue tones, dreamy fashion photography', category: 'abstract' },
  { id: 'gradient-sunset', name: 'Sunset Gradient', prompt: 'warm sunset gradient background, orange to purple transition, dramatic fashion photography', category: 'abstract' },
  { id: 'smoke-mist', name: 'Smoke & Mist', prompt: 'ethereal smoke and mist background, soft swirling wisps, mysterious atmospheric mood, artistic editorial', category: 'abstract' },
  { id: 'geometric', name: 'Geometric', prompt: 'modern geometric abstract background, clean lines and shapes, minimalist contemporary design aesthetic', category: 'abstract' },
  { id: 'holographic', name: 'Holographic', prompt: 'iridescent holographic background, rainbow light reflections, futuristic dreamy atmosphere', category: 'abstract' },
  { id: 'gold-shimmer', name: 'Gold Shimmer', prompt: 'luxurious shimmering gold background, elegant metallic reflections, glamorous high-fashion aesthetic', category: 'abstract' },
  { id: 'prism-rainbow', name: 'Prism Rainbow', prompt: 'prismatic rainbow light effects, colorful light refractions, artistic creative fashion photography', category: 'abstract' },
  { id: 'textured-concrete', name: 'Textured Concrete', prompt: 'raw textured concrete background, industrial minimalist aesthetic, dramatic shadows', category: 'abstract' },
  { id: 'silk-fabric', name: 'Silk Fabric', prompt: 'flowing silk fabric background, soft luxurious folds, elegant fashion photography backdrop', category: 'abstract' },
  { id: 'digital-glitch', name: 'Digital Glitch', prompt: 'digital glitch art background, distorted pixels, futuristic cyberpunk aesthetic, edgy fashion', category: 'abstract' },
  { id: 'paint-splatter', name: 'Paint Splatter', prompt: 'artistic paint splatter background, colorful abstract expressionism, creative fashion photography', category: 'abstract' },

  // ===========================================
  // LUXURY - High-end locations
  // ===========================================
  { id: 'penthouse', name: 'Penthouse', prompt: 'luxurious modern penthouse interior, floor-to-ceiling windows, city lights panorama, sophisticated evening ambiance', category: 'luxury' },
  { id: 'yacht-deck', name: 'Yacht Deck', prompt: 'elegant luxury yacht deck, pristine white surfaces, azure ocean backdrop, exclusive Mediterranean atmosphere', category: 'luxury' },
  { id: 'champagne-lounge', name: 'Champagne Lounge', prompt: 'opulent champagne lounge, velvet furnishings, crystal chandeliers, warm golden ambient lighting', category: 'luxury' },
  { id: 'fashion-runway', name: 'Runway', prompt: 'haute couture fashion runway, dramatic spotlights, sleek minimal stage design, high fashion event atmosphere', category: 'luxury' },
  { id: 'boutique-hotel', name: 'Boutique Hotel', prompt: 'elegant boutique hotel lobby, art deco design, marble floors, tasteful luxury interior design', category: 'luxury' },
  { id: 'private-jet', name: 'Private Jet', prompt: 'luxurious private jet interior, cream leather seats, polished wood accents, exclusive travel lifestyle', category: 'luxury' },
  { id: 'mansion-garden', name: 'Estate Garden', prompt: 'manicured mansion garden, classical architecture, elegant fountain, refined aristocratic atmosphere', category: 'luxury' },
  { id: 'art-gallery', name: 'Art Gallery', prompt: 'sophisticated modern art gallery, minimalist white walls, curated artwork, cultural elite atmosphere', category: 'luxury' },
  { id: 'luxury-spa', name: 'Luxury Spa', prompt: 'exclusive luxury spa interior, marble surfaces, soft ambient lighting, relaxation and wellness', category: 'luxury' },
  { id: 'palace-interior', name: 'Palace Interior', prompt: 'opulent palace interior, ornate gilded details, grand chandeliers, royal aristocratic elegance', category: 'luxury' },
  { id: 'rooftop-pool', name: 'Rooftop Pool', prompt: 'infinity rooftop pool, city skyline view, sunset ambiance, luxury lifestyle fashion', category: 'luxury' },
  { id: 'wine-cellar', name: 'Wine Cellar', prompt: 'elegant wine cellar, barrel-vaulted ceiling, ambient candlelight, sophisticated atmosphere', category: 'luxury' },
  { id: 'casino-floor', name: 'Casino Floor', prompt: 'glamorous casino floor, bright lights, elegant evening atmosphere, high roller fashion', category: 'luxury' },
  { id: 'opera-house', name: 'Opera House', prompt: 'grand opera house interior, red velvet seats, ornate architecture, cultural elegance', category: 'luxury' }
];

export type CreateOutfitResponse = OutfitDto;
