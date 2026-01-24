import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  from,
  of,
  throwError
} from 'rxjs';
import {
  catchError,
  concatMap,
  distinctUntilChanged,
  filter,
  map,
  tap,
  switchMap,
  take,
  toArray
} from 'rxjs/operators';

import {
  Garment,
  GarmentGroup,
  GeneratedImage,
  OutfitImageVariant,
  OutfitRequest,
  OutfitRequestSnapshot,
  SelectedInspiration,
  CreateOutfitDto,
  OutfitDto,
  OutfitGarment,
  AspectRatioOption,
  BACKGROUND_PROMPT_PRESETS,
  POSE_PRESETS
} from '../models/outfit';

import {
  GarmentSummaryDto,
  CatalogueOption,
  GarmentCategoryDto,
  GarmentImageDto,
  BackgroundImageDto,
  ImagePerspectiveDto
} from '../models/outfitify-api';

import { OutfitifyApiService } from './outfitify-api.service';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { UserProfile } from '../models/user';

// -------------------------------------
// DTO for /api/model-images endpoints
// -------------------------------------
export interface ModelImageDto {
  modelImageId: string;
  name: string;
  imageUrl: string;
  poseOptionId: string;
  notes: string | null;
  isActive: boolean;
  createdAtUtc: string | null;
  archivedAtUtc?: string | null;
  isBackgroundVariant?: boolean;
  sourceModelImageId?: string | null;
  backgroundPrompt?: string | null;
  /** Indicates this is a preloaded template model image */
  isTemplate?: boolean;
}

export interface CreateModelImageDto {
  name: string;
  poseOptionId?: string | null;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OutfitService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  // Maximum models allowed for multi-selection
  private readonly MAX_SELECTED_MODELS = 5;

  // LocalStorage key for tracking first visit
  private readonly FIRST_VISIT_KEY = 'outfitify_first_visit';

  // --- Core selection state ---

  private readonly inspirationSubject = new BehaviorSubject<SelectedInspiration | null>(
    null
  );

  // Multi-model selection
  private readonly selectedModelsSubject = new BehaviorSubject<SelectedInspiration[]>([]);

  // All model images the user has uploaded
  private readonly userModelImagesSubject = new BehaviorSubject<SelectedInspiration[]>(
    []
  );
  private userModelImagesLoaded = false;

  private readonly topGarmentsSubject = new BehaviorSubject<Garment[]>([]);
  private readonly bottomGarmentsSubject = new BehaviorSubject<Garment[]>([]);
  private readonly fullBodyGarmentsSubject = new BehaviorSubject<Garment[]>([]);
  private readonly jacketGarmentsSubject = new BehaviorSubject<Garment[]>([]);
  private readonly footwearGarmentsSubject = new BehaviorSubject<Garment[]>([]);
  private readonly accessoriesGarmentsSubject = new BehaviorSubject<Garment[]>([]);

  private readonly topSizesSubject = new BehaviorSubject<Record<string, string | null>>({});
  private readonly bottomSizesSubject = new BehaviorSubject<Record<string, string | null>>({});
  private readonly fullBodySizesSubject = new BehaviorSubject<Record<string, string | null>>({});
  private readonly jacketSizesSubject = new BehaviorSubject<Record<string, string | null>>({});
  private readonly footwearSizesSubject = new BehaviorSubject<Record<string, string | null>>({});
  private readonly accessoriesSizesSubject = new BehaviorSubject<Record<string, string | null>>({});

  // Model image / pose / background
  // modelIdSubject now holds the ModelImageId (user upload)
  private readonly modelIdSubject = new BehaviorSubject<string | null>(null);
  private readonly poseIdSubject = new BehaviorSubject<string | null>(null);
  private readonly posePromptSubject = new BehaviorSubject<string | null>(null);
  private readonly backgroundIdSubject = new BehaviorSubject<string | null>(null);
  private readonly customBackgroundPromptSubject = new BehaviorSubject<string | null>(null);
  private readonly aspectRatioSubject = new BehaviorSubject<AspectRatioOption>('original');
  private readonly backgroundOptionsSubject = new BehaviorSubject<CatalogueOption[]>([]);
  private backgroundOptionsLoaded = false;

  // UI state persistence for studio (pose preset, background preset)
  private readonly selectedPosePresetIdSubject = new BehaviorSubject<string>('original');
  private readonly selectedBackgroundPresetIdSubject = new BehaviorSubject<string | null>(null);

  // --- Gallery state ---

  private readonly garmentsSubject = new BehaviorSubject<Garment[]>([]);
  private garmentsLoaded = false;
  private readonly garmentCategoriesSubject = new BehaviorSubject<GarmentCategoryDto[]>([]);
  private garmentCategoriesLoaded = false;
  private readonly imagePerspectivesSubject = new BehaviorSubject<ImagePerspectiveDto[]>([]);
  private imagePerspectivesLoaded = false;

  private readonly generatedImagesSubject = new BehaviorSubject<GeneratedImage[]>([]);
  private readonly galleryIndexSubject = new BehaviorSubject<number>(0);
  private currentUser: UserProfile | null = null;

  constructor(
    private readonly outfitifyApi: OutfitifyApiService,
    private readonly auth: AuthService
  ) {
    this.auth.token$
      .pipe(
        map((token) => token?.trim() ?? ''),
        distinctUntilChanged(),
        filter(Boolean),
        take(1)
      )
      .subscribe(() => this.initialiseDefaultPoseAndBackground());
    this.auth.user$.subscribe((user) => this.applyUserContext(user));
  }

  // -----------------------------
  // Helpers
  // -----------------------------

  private createApiUnavailableError(action: string, error: unknown): Error {
    const baseUrl = this.apiBaseUrl?.trim();

    if (error instanceof HttpErrorResponse && error.status === 0) {
      return new Error(
        `Unable to reach OutfitifyAPI while ${action}. Check that \`${baseUrl}\` is a valid, reachable endpoint.`
      );
    }

    if (error instanceof Error) {
      return new Error(
        `${error.message} (while ${action}; OutfitifyAPI base URL: ${
          baseUrl || 'not configured'
        })`
      );
    }

    return new Error(
      `OutfitifyAPI request failed while ${action}. Verify \`${
        baseUrl || 'environment.apiBaseUrl'
      }\` and authentication settings.`
    );
  }

  private getApiBaseUrlOrThrow(): string {
    const baseUrl = this.apiBaseUrl?.trim();

    if (!baseUrl) {
      throw new Error(
        'OutfitifyAPI base URL is not configured. Update environment.apiBaseUrl in src/environments/*.ts to point to your OutfitifyAPI deployment.'
      );
    }

    return baseUrl;
  }

  private applyUserContext(user: UserProfile | null): void {
    const previousUser = this.currentUser;
    const clientChanged = previousUser?.clientId !== user?.clientId;
    const userChanged = previousUser?.id !== user?.id;
    this.currentUser = user;

    // Clear all user-specific state when user changes or logs out
    if (!user || userChanged) {
      // Clear selections
      this.modelIdSubject.next(null);
      this.poseIdSubject.next(null);
      this.backgroundIdSubject.next(null);
      this.backgroundOptionsLoaded = false;
      this.backgroundOptionsSubject.next([]);

      // Clear generated images and gallery
      this.generatedImagesSubject.next([]);
      this.galleryIndexSubject.next(0);

      // Clear selected models and garments
      this.selectedModelsSubject.next([]);
      this.topGarmentsSubject.next([]);
      this.bottomGarmentsSubject.next([]);
      this.fullBodyGarmentsSubject.next([]);
      this.jacketGarmentsSubject.next([]);
      this.footwearGarmentsSubject.next([]);
      this.accessoriesGarmentsSubject.next([]);

      // Clear UI state
      this.selectedPosePresetIdSubject.next('original');
      this.selectedBackgroundPresetIdSubject.next(null);
      this.customBackgroundPromptSubject.next(null);
      this.posePromptSubject.next(null);
      this.aspectRatioSubject.next('original');

      if (!user) {
        return;
      }
    }

    if (user.modelImageId) {
      this.modelIdSubject.next(user.modelImageId);
    }

    if (user.poseOptionId) {
      this.poseIdSubject.next(user.poseOptionId);
    }

    if (clientChanged && !userChanged) {
      // Client changed but not full user change - just clear client-specific data
      this.backgroundIdSubject.next(null);
      this.backgroundOptionsLoaded = false;
      this.backgroundOptionsSubject.next([]);
    }

    if (user.backgroundOptionId) {
      this.backgroundIdSubject.next(user.backgroundOptionId);
    }
  }

  private initialiseDefaultPoseAndBackground(): void {
    if (!this.apiBaseUrl?.trim()) {
      console.warn(
        'Skipping default pose load because no OutfitifyAPI base URL is configured.'
      );
      return;
    }

    if (!this.auth.isLoggedIn()) {
      return;
    }

    // Pose
    this.outfitifyApi
      .listPoses()
      .pipe(take(1))
      .subscribe({
        next: (poses: CatalogueOption[]) => {
          const first = poses[0];
          if (first?.id) {
            this.poseIdSubject.next(first.id);
          }
        },
        error: (err) => {
          console.error(this.createApiUnavailableError('loading default pose', err));
        }
      });

  }

  // -----------------------------
  // Public streams
  // -----------------------------

  readonly selectedInspiration$ = this.inspirationSubject.asObservable();

  // Multi-model selection
  readonly selectedModels$ = this.selectedModelsSubject.asObservable();
  readonly selectedModelCount$ = this.selectedModelsSubject.pipe(
    map(models => models.length),
    distinctUntilChanged()
  );

  // Saved model images for current user
  readonly userModelImages$ = this.userModelImagesSubject.asObservable();

  readonly selectedTop$ = this.topGarmentsSubject.asObservable();
  readonly selectedBottom$ = this.bottomGarmentsSubject.asObservable();
  readonly selectedFullBody$ = this.fullBodyGarmentsSubject.asObservable();
  readonly selectedJacket$ = this.jacketGarmentsSubject.asObservable();
  readonly selectedFootwear$ = this.footwearGarmentsSubject.asObservable();
  readonly selectedAccessories$ = this.accessoriesGarmentsSubject.asObservable();

  readonly selectedTopSize$ = this.topSizesSubject.asObservable();
  readonly selectedBottomSize$ = this.bottomSizesSubject.asObservable();
  readonly selectedFullBodySize$ = this.fullBodySizesSubject.asObservable();
  readonly selectedJacketSize$ = this.jacketSizesSubject.asObservable();
  readonly selectedFootwearSize$ = this.footwearSizesSubject.asObservable();
  readonly selectedAccessoriesSize$ = this.accessoriesSizesSubject.asObservable();

  readonly selectedModelId$ = this.modelIdSubject.asObservable();
  readonly selectedPoseId$ = this.poseIdSubject.asObservable();
  readonly selectedBackgroundId$ = this.backgroundIdSubject.asObservable();
  readonly customBackgroundPrompt$ = this.customBackgroundPromptSubject.asObservable();
  readonly selectedAspectRatio$ = this.aspectRatioSubject.asObservable();
  readonly backgroundOptions$ = this.backgroundOptionsSubject.asObservable();

  // UI state persistence for studio
  readonly selectedPosePresetId$ = this.selectedPosePresetIdSubject.asObservable();
  readonly selectedBackgroundPresetId$ = this.selectedBackgroundPresetIdSubject.asObservable();

  readonly selectedBackground$ = combineLatest([
    this.selectedBackgroundId$,
    this.backgroundOptions$
  ]).pipe(
    map(
      ([selectedId, options]) =>
        options.find((option) => option.id === selectedId) ?? null
    )
  );

  readonly selectedGarments$ = combineLatest([
    this.selectedTop$,
    this.selectedBottom$,
    this.selectedFullBody$,
    this.selectedJacket$,
    this.selectedFootwear$,
    this.selectedAccessories$
  ]).pipe(
    map(([top, bottom, fullBody, jacket, footwear, accessories]) => ({
      top,
      bottom,
      fullBody,
      jacket,
      footwear,
      accessories
    }))
  );

  readonly selectedSizes$ = combineLatest([
    this.selectedTopSize$,
    this.selectedBottomSize$,
    this.selectedFullBodySize$,
    this.selectedJacketSize$,
    this.selectedFootwearSize$,
    this.selectedAccessoriesSize$
  ]).pipe(
    map(([top, bottom, fullBody, jacket, footwear, accessories]) => ({
      top,
      bottom,
      fullBody,
      jacket,
      footwear,
      accessories
    }))
  );

  readonly garments$ = this.garmentsSubject.asObservable();
  readonly garmentCategories$ = this.garmentCategoriesSubject.asObservable();
  readonly imagePerspectives$ = this.imagePerspectivesSubject.asObservable();

  // These two are what `garment-library.component.ts` expects
  // Allow any combination: at least one garment from any category
  readonly hasCompleteGarmentSelection$ = this.selectedGarments$.pipe(
    map((garments) => {
      const totalGarments =
        garments.top.length +
        garments.bottom.length +
        garments.fullBody.length +
        garments.jacket.length +
        garments.footwear.length +
        garments.accessories.length;

      return totalGarments > 0;
    }),
    distinctUntilChanged()
  );

  // Credits cost calculation: (2 base + 1 pose + 1 background) * modelCount
  readonly estimatedCreditsCost$ = combineLatest([
    this.posePromptSubject,
    this.selectedBackgroundId$,
    this.customBackgroundPrompt$,
    this.selectedModelCount$
  ]).pipe(
    map(([posePrompt, backgroundId, customPrompt, modelCount]) => {
      // Per-model cost
      let perModelCost = 2;

      // +1 if pose is changed
      const hasPoseChange = !!posePrompt;
      if (hasPoseChange) {
        perModelCost += 1;
      }

      // +1 if background is changed (either preset or custom prompt)
      const hasBackgroundChange = !!backgroundId || !!customPrompt;
      if (hasBackgroundChange) {
        perModelCost += 1;
      }

      // Total = per-model cost * number of models (minimum 1)
      return perModelCost * Math.max(modelCount, 1);
    }),
    distinctUntilChanged()
  );

  readonly hasCompleteSelection$ = combineLatest([
    this.selectedGarments$,
    this.selectedSizes$
  ]).pipe(
    map(([garments, sizes]) => {
      const hasFullBody = garments.fullBody.length > 0 && Object.values(sizes.fullBody).some(s => s);
      const hasTopBottom =
        garments.top.length > 0 && garments.bottom.length > 0 &&
        Object.values(sizes.top).some(s => s) && Object.values(sizes.bottom).some(s => s);

      return hasFullBody || hasTopBottom;
    }),
    distinctUntilChanged()
  );

  readonly generatedImages$ = this.generatedImagesSubject.asObservable();
  readonly currentGalleryIndex$ = this.galleryIndexSubject.asObservable();

  readonly outfitRequest$: Observable<OutfitRequestSnapshot> = combineLatest([
    this.selectedInspiration$,
    this.selectedGarments$,
    this.selectedSizes$
  ]).pipe(
    map(([inspiration, garments, sizes]) => ({
      inspiration,
      garments,
      sizes
    }) satisfies OutfitRequest)
  );

  // -----------------------------
  // Mutators
  // -----------------------------

  setInspiration(selection: SelectedInspiration | null): void {
    this.inspirationSubject.next(selection);
  }

  // -----------------------------
  // Multi-model selection
  // -----------------------------

  /**
   * Toggles a model's selection state for multi-model mode.
   * Returns true if model was added, false if removed or limit reached.
   */
  toggleModelSelection(model: SelectedInspiration): boolean {
    const current = this.selectedModelsSubject.value;
    const existingIndex = current.findIndex(m => m.id === model.id);

    if (existingIndex >= 0) {
      // Remove model
      const updated = current.filter((_, i) => i !== existingIndex);
      this.selectedModelsSubject.next(updated);

      // Update single inspiration for backward compatibility
      if (updated.length > 0) {
        this.inspirationSubject.next(updated[0]);
        this.modelIdSubject.next(updated[0].id ?? null);
      } else {
        this.inspirationSubject.next(null);
        this.modelIdSubject.next(null);
      }

      return false;
    } else {
      // Check if max limit reached
      if (current.length >= this.MAX_SELECTED_MODELS) {
        console.warn(`[OutfitService] Max ${this.MAX_SELECTED_MODELS} models allowed`);
        return false;
      }

      // Add model
      const updated = [...current, model];
      this.selectedModelsSubject.next(updated);

      // Update single inspiration to first selected model
      this.inspirationSubject.next(updated[0]);
      this.modelIdSubject.next(updated[0].id ?? null);

      return true;
    }
  }

  /**
   * Checks if a model is currently selected.
   */
  isModelSelected(modelId: string | undefined): boolean {
    if (!modelId) return false;
    return this.selectedModelsSubject.value.some(m => m.id === modelId);
  }

  /**
   * Clears all selected models.
   */
  clearModelSelection(): void {
    this.selectedModelsSubject.next([]);
    this.inspirationSubject.next(null);
    this.modelIdSubject.next(null);
  }

  /**
   * Gets the maximum number of models allowed.
   */
  getMaxSelectedModels(): number {
    return this.MAX_SELECTED_MODELS;
  }

  /**
   * Gets the current selected models array.
   */
  getSelectedModels(): SelectedInspiration[] {
    return this.selectedModelsSubject.value;
  }

  /**
   * Sets which model is shown as the primary preview (must be one of the selected models).
   */
  setPreviewModel(model: SelectedInspiration): void {
    const selectedModels = this.selectedModelsSubject.value;
    if (selectedModels.some(m => m.id === model.id)) {
      this.inspirationSubject.next(model);
    }
  }

  /**
   * Gets the current preview model.
   */
  getPreviewModel(): SelectedInspiration | null {
    return this.inspirationSubject.value;
  }

  // -----------------------------
  // User model images (/api/model-images)
  // -----------------------------

  ensureUserModelImagesLoaded(): Observable<SelectedInspiration[]> {
    if (this.userModelImagesLoaded) {
      return of(this.userModelImagesSubject.value);
    }
    return this.loadUserModelImages();
  }

  /**
   * Force reload user model images from API, bypassing cache.
   * Use this after creating outfits with new backgrounds to see the generated variants.
   */
  forceReloadUserModelImages(): Observable<SelectedInspiration[]> {
    this.userModelImagesLoaded = false;
    return this.loadUserModelImages();
  }

  private loadUserModelImages(): Observable<SelectedInspiration[]> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Unable to load model images from OutfitifyAPI', error);
      this.userModelImagesSubject.next([]);
      return throwError(() => error);
    }

    return this.outfitifyApi
      .listModelImages()
      .pipe(
        map((items: ModelImageDto[]) =>
          items.map((dto) => this.mapModelImageDtoToInspiration(dto))
        ),
        tap((images: SelectedInspiration[]) => {
          this.userModelImagesSubject.next(images);
          this.userModelImagesLoaded = true;

          // Auto-select first template model on first visit (#1, #3)
          this.autoSelectDefaultModelOnFirstVisit(images);
        }),
        catchError((error: unknown) => {
          console.error(
            'Unable to load model images from OutfitifyAPI',
            this.createApiUnavailableError('loading model images', error)
          );
          this.userModelImagesSubject.next([]);
          return throwError(() =>
            this.createApiUnavailableError('loading model images', error)
          );
        })
      );
  }

  /**
   * Auto-selects the first template model on the user's first visit.
   * Uses localStorage to track whether auto-selection has already occurred.
   */
  private autoSelectDefaultModelOnFirstVisit(images: SelectedInspiration[]): void {
    // Skip if already has selection
    if (this.selectedModelsSubject.value.length > 0) {
      return;
    }

    // Check if this is first visit
    const hasVisited = localStorage.getItem(this.FIRST_VISIT_KEY);
    if (hasVisited) {
      return;
    }

    // Find first template model
    const templateModel = images.find(img => img.isTemplate);
    if (templateModel) {
      // Auto-select the template model
      this.toggleModelSelection(templateModel);
      console.log('[OutfitService] Auto-selected default template model:', templateModel.name || templateModel.id);
    }

    // Mark as visited (even if no template found, so we don't keep trying)
    localStorage.setItem(this.FIRST_VISIT_KEY, 'true');
  }

  // -----------------------------
  // Upload /api/model-images/upload
  // -----------------------------

  /**
   * Upload a model image without auto-selecting it.
   * The image will be added to the saved photos list but not selected.
   */
  uploadModelImage(
    file: File,
    previewUrl: string
  ): Observable<SelectedInspiration> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Failed to upload model image', error);
      throw error;
    }

    const formData = new FormData();
    formData.append('fileData', file, file.name);
    formData.append('Name', file.name);

    const poseOptionId = this.poseIdSubject.value;
    if (poseOptionId) {
      formData.append('PoseOptionId', poseOptionId);
    }

    return this.outfitifyApi
      .uploadModelImage(formData)
      .pipe(
        map((response: ModelImageDto) => {
          const resolvedUrl = this.resolveAssetUrl(response.imageUrl);
          const selection: SelectedInspiration = {
            file,
            previewUrl,
            source: 'upload',
            remoteUrl: resolvedUrl,
            id: response.modelImageId
          };
          return selection;
        }),
        tap((selection) => {
          // Add to saved photos list but don't select
          if (selection.id) {
            const current = this.userModelImagesSubject.value;
            const exists = current.some((img) => img.id === selection.id);
            if (!exists) {
              this.userModelImagesSubject.next([...current, selection]);
            }
          }
        })
      );
  }

  /**
   * @deprecated Use uploadModelImage() instead and let user select manually
   */
  uploadAndSetInspiration(
    file: File,
    previewUrl: string
  ): Observable<SelectedInspiration> {
    return this.uploadModelImage(file, previewUrl).pipe(
      tap((selection) => {
        this.setInspiration(selection);
        if (selection.id) {
          this.modelIdSubject.next(selection.id);
        }
      }),
      catchError((error: unknown) => {
        console.error('Failed to upload model image', error);
        const selection: SelectedInspiration = {
          file,
          previewUrl,
          source: 'upload'
        };
        this.setInspiration(selection);
        return of(selection);
      })
    );
  }


  // -----------------------------
  // Garment selection
  // -----------------------------

  // Max limits for each garment category
  private readonly maxGarmentLimits: Record<GarmentGroup, number> = {
    'tops': 2,
    'bottoms': 2,
    'full-body': 1,
    'jackets': 2,
    'footwear': 1,
    'accessories': 3
  };

  toggleSelectedGarment(group: GarmentGroup, garment: Garment): void {
    let garmentsSubject: BehaviorSubject<Garment[]>;
    let sizesSubject: BehaviorSubject<Record<string, string | null>>;

    switch (group) {
      case 'tops':
        garmentsSubject = this.topGarmentsSubject;
        sizesSubject = this.topSizesSubject;
        break;
      case 'bottoms':
        garmentsSubject = this.bottomGarmentsSubject;
        sizesSubject = this.bottomSizesSubject;
        break;
      case 'full-body':
        garmentsSubject = this.fullBodyGarmentsSubject;
        sizesSubject = this.fullBodySizesSubject;
        break;
      case 'jackets':
        garmentsSubject = this.jacketGarmentsSubject;
        sizesSubject = this.jacketSizesSubject;
        break;
      case 'footwear':
        garmentsSubject = this.footwearGarmentsSubject;
        sizesSubject = this.footwearSizesSubject;
        break;
      case 'accessories':
        garmentsSubject = this.accessoriesGarmentsSubject;
        sizesSubject = this.accessoriesSizesSubject;
        break;
      default:
        return;
    }

    const currentGarments = garmentsSubject.value;
    const isSelected = currentGarments.some(g => g.id === garment.id);

    if (isSelected) {
      // Remove from selection
      const updated = currentGarments.filter(g => g.id !== garment.id);
      garmentsSubject.next(updated);

      // Remove size entry for this garment
      const sizes = sizesSubject.value;
      const updatedSizes = { ...sizes };
      delete updatedSizes[garment.id];
      sizesSubject.next(updatedSizes);
    } else {
      // Check if max limit reached for this group
      const maxLimit = this.maxGarmentLimits[group];
      if (currentGarments.length >= maxLimit) {
        console.warn(`[OutfitService] Max ${maxLimit} ${group} garment(s) allowed`);
        return; // Don't add more
      }

      // Add to selection
      const updated = [...currentGarments, garment];
      garmentsSubject.next(updated);

      // Set default size
      const sizes = garment.sizes ?? [];
      const defaultSize = sizes.length > 0
        ? sizes[0]
        : group === 'bottoms'
          ? '32'
          : 'M';

      const updatedSizes = { ...sizesSubject.value, [garment.id]: defaultSize };
      sizesSubject.next(updatedSizes);
    }
  }

  setSelectedSize(group: GarmentGroup, garmentId: string, size: string | null): void {
    let sizesSubject: BehaviorSubject<Record<string, string | null>>;

    switch (group) {
      case 'tops':
        sizesSubject = this.topSizesSubject;
        break;
      case 'bottoms':
        sizesSubject = this.bottomSizesSubject;
        break;
      case 'full-body':
        sizesSubject = this.fullBodySizesSubject;
        break;
      case 'jackets':
        sizesSubject = this.jacketSizesSubject;
        break;
      case 'footwear':
        sizesSubject = this.footwearSizesSubject;
        break;
      case 'accessories':
        sizesSubject = this.accessoriesSizesSubject;
        break;
      default:
        return;
    }

    const updatedSizes = { ...sizesSubject.value };
    if (size === null) {
      delete updatedSizes[garmentId];
    } else {
      updatedSizes[garmentId] = size;
    }
    sizesSubject.next(updatedSizes);
  }

  isGarmentSelected(group: GarmentGroup, garmentId: string): boolean {
    let garmentsSubject: BehaviorSubject<Garment[]>;

    switch (group) {
      case 'tops':
        garmentsSubject = this.topGarmentsSubject;
        break;
      case 'bottoms':
        garmentsSubject = this.bottomGarmentsSubject;
        break;
      case 'full-body':
        garmentsSubject = this.fullBodyGarmentsSubject;
        break;
      case 'jackets':
        garmentsSubject = this.jacketGarmentsSubject;
        break;
      case 'footwear':
        garmentsSubject = this.footwearGarmentsSubject;
        break;
      case 'accessories':
        garmentsSubject = this.accessoriesGarmentsSubject;
        break;
      default:
        return false;
    }

    return garmentsSubject.value.some(g => g.id === garmentId);
  }

  // Legacy method for backward compatibility
  setSelectedGarment(group: GarmentGroup, garment: Garment | null): void {
    let garmentsSubject: BehaviorSubject<Garment[]>;
    let sizesSubject: BehaviorSubject<Record<string, string | null>>;

    switch (group) {
      case 'tops':
        garmentsSubject = this.topGarmentsSubject;
        sizesSubject = this.topSizesSubject;
        break;
      case 'bottoms':
        garmentsSubject = this.bottomGarmentsSubject;
        sizesSubject = this.bottomSizesSubject;
        break;
      case 'full-body':
        garmentsSubject = this.fullBodyGarmentsSubject;
        sizesSubject = this.fullBodySizesSubject;
        break;
      case 'jackets':
        garmentsSubject = this.jacketGarmentsSubject;
        sizesSubject = this.jacketSizesSubject;
        break;
      case 'footwear':
        garmentsSubject = this.footwearGarmentsSubject;
        sizesSubject = this.footwearSizesSubject;
        break;
      case 'accessories':
        garmentsSubject = this.accessoriesGarmentsSubject;
        sizesSubject = this.accessoriesSizesSubject;
        break;
      default:
        return;
    }

    if (garment === null) {
      garmentsSubject.next([]);
      sizesSubject.next({});
    } else {
      garmentsSubject.next([garment]);
      const sizes = garment.sizes ?? [];
      const defaultSize = sizes.length > 0
        ? sizes[0]
        : group === 'bottoms'
          ? '32'
          : 'M';
      sizesSubject.next({ [garment.id]: defaultSize });
    }
  }

  /**
   * Clears all selected garments across all categories.
   * Resets both garment selections and their associated sizes.
   */
  clearAllGarments(): void {
    this.topGarmentsSubject.next([]);
    this.bottomGarmentsSubject.next([]);
    this.fullBodyGarmentsSubject.next([]);
    this.jacketGarmentsSubject.next([]);
    this.footwearGarmentsSubject.next([]);
    this.accessoriesGarmentsSubject.next([]);

    this.topSizesSubject.next({});
    this.bottomSizesSubject.next({});
    this.fullBodySizesSubject.next({});
    this.jacketSizesSubject.next({});
    this.footwearSizesSubject.next({});
    this.accessoriesSizesSubject.next({});
  }

  /**
   * Clears selected garments for a specific category.
   */
  clearGarmentCategory(group: GarmentGroup): void {
    switch (group) {
      case 'tops':
        this.topGarmentsSubject.next([]);
        this.topSizesSubject.next({});
        break;
      case 'bottoms':
        this.bottomGarmentsSubject.next([]);
        this.bottomSizesSubject.next({});
        break;
      case 'full-body':
        this.fullBodyGarmentsSubject.next([]);
        this.fullBodySizesSubject.next({});
        break;
      case 'jackets':
        this.jacketGarmentsSubject.next([]);
        this.jacketSizesSubject.next({});
        break;
      case 'footwear':
        this.footwearGarmentsSubject.next([]);
        this.footwearSizesSubject.next({});
        break;
      case 'accessories':
        this.accessoriesGarmentsSubject.next([]);
        this.accessoriesSizesSubject.next({});
        break;
    }
  }

  // For Shopify / admin where model/pose/background are explicit choices
  setSelectedModel(option: { id: string } | null): void {
    this.modelIdSubject.next(option?.id ?? null);
  }

  setSelectedPose(option: { id: string } | null): void {
    this.poseIdSubject.next(option?.id ?? null);
  }

  setSelectedBackground(option: { id: string } | null): void {
    this.backgroundIdSubject.next(option?.id ?? null);
    // Clear custom prompt when selecting a predefined background
    if (option?.id) {
      this.customBackgroundPromptSubject.next(null);
    }
  }

  setCustomBackgroundPrompt(prompt: string | null): void {
    this.customBackgroundPromptSubject.next(prompt);
    // Clear background selection when setting a custom prompt
    if (prompt) {
      this.backgroundIdSubject.next(null);
    }
  }

  setAspectRatio(ratio: AspectRatioOption): void {
    this.aspectRatioSubject.next(ratio);
  }

  setPosePrompt(prompt: string | null): void {
    this.posePromptSubject.next(prompt);
  }

  getAspectRatio(): AspectRatioOption {
    return this.aspectRatioSubject.value;
  }

  // UI state persistence for studio
  setSelectedPosePresetId(presetId: string): void {
    this.selectedPosePresetIdSubject.next(presetId);
  }

  getSelectedPosePresetId(): string {
    return this.selectedPosePresetIdSubject.value;
  }

  setSelectedBackgroundPresetId(presetId: string | null): void {
    this.selectedBackgroundPresetIdSubject.next(presetId);
  }

  getSelectedBackgroundPresetId(): string | null {
    return this.selectedBackgroundPresetIdSubject.value;
  }

  getCustomBackgroundPrompt(): string | null {
    return this.customBackgroundPromptSubject.value;
  }

  ensureBackgroundOptionsLoaded(): Observable<CatalogueOption[]> {
    if (this.backgroundOptionsLoaded) {
      return of(this.backgroundOptionsSubject.value);
    }

    return this.loadBackgroundOptions();
  }

  private loadBackgroundOptions(): Observable<CatalogueOption[]> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Unable to load background options from OutfitifyAPI', error);
      this.backgroundOptionsSubject.next([]);
      return throwError(() => error);
    }

    return this.outfitifyApi.listBackgroundImages().pipe(
      map((backgrounds: BackgroundImageDto[]) =>
        backgrounds.map((dto) => this.mapBackgroundImageDtoToCatalogueOption(dto))
      ),
      tap((backgrounds: CatalogueOption[]) => {
        this.backgroundOptionsSubject.next(backgrounds);
        this.backgroundOptionsLoaded = true;

        if (!this.backgroundIdSubject.value && backgrounds[0]?.id) {
          this.setSelectedBackground(backgrounds[0]);
        }
      }),
      catchError((error: unknown) => {
        console.error(
          'Unable to load background options from OutfitifyAPI',
          this.createApiUnavailableError('loading background options', error)
        );
        this.backgroundOptionsSubject.next([]);
        return throwError(() =>
          this.createApiUnavailableError('loading background options', error)
        );
      })
    );
  }

  // -----------------------------
  // Garments catalogue
  // -----------------------------

  ensureGarmentsLoaded(): Observable<Garment[]> {
    if (this.garmentsLoaded) {
      return of(this.garmentsSubject.value);
    }
    return this.loadGarments();
  }

  /**
   * Force reload garments from API, bypassing cache.
   * Use this after creating, updating, or deleting garments.
   */
  forceReloadGarments(): Observable<Garment[]> {
    this.garmentsLoaded = false;
    return this.loadGarments();
  }

  ensureGarmentCategoriesLoaded(): Observable<GarmentCategoryDto[]> {
    if (this.garmentCategoriesLoaded) {
      return of(this.garmentCategoriesSubject.value);
    }
    return this.loadGarmentCategories();
  }

  ensureImagePerspectivesLoaded(): Observable<ImagePerspectiveDto[]> {
    if (this.imagePerspectivesLoaded) {
      return of(this.imagePerspectivesSubject.value);
    }
    return this.loadImagePerspectives();
  }

  loadGarments(): Observable<Garment[]> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Unable to load garments from OutfitifyAPI', error);
      this.garmentsSubject.next([]);
      return throwError(() => error);
    }

    return this.outfitifyApi
      .listGarments()
      .pipe(
        // Debug: log raw DTOs coming from the API so we can inspect field names
        tap((items: GarmentSummaryDto[]) => {
          try {
            console.log('[OutfitService] raw garments DTOs:', { count: items?.length ?? 0, sample: (items ?? []).slice(0, 10) });
            const keys = (items ?? []).map(i => Object.keys(i));
            console.log('[OutfitService] garment DTO keys (first 10):', keys.slice(0, 10));
          } catch (e) {
            console.error('[OutfitService] error logging raw garments DTOs', e);
          }
        }),
        map((items: GarmentSummaryDto[]) =>
          items.map((dto) => this.mapGarmentSummaryToGarment(dto))
        ),
        tap((garments: Garment[]) => {
          this.garmentsSubject.next(garments);
          this.garmentsLoaded = true;
        }),
        catchError((error: unknown) => {
          console.error('Unable to load garments from OutfitifyAPI', error);
          this.garmentsSubject.next([]);
          return throwError(() =>
            this.createApiUnavailableError('loading garments', error)
          );
        })
      );
  }

  private loadGarmentCategories(): Observable<GarmentCategoryDto[]> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Unable to load garment categories from OutfitifyAPI', error);
      this.garmentCategoriesSubject.next([]);
      return throwError(() => error);
    }

    return this.outfitifyApi.listGarmentCategories().pipe(
      tap((categories: GarmentCategoryDto[]) => {
        this.garmentCategoriesSubject.next(categories);
        this.garmentCategoriesLoaded = true;
      }),
      catchError((error: unknown) => {
        console.error(
          'Unable to load garment categories from OutfitifyAPI',
          this.createApiUnavailableError('loading garment categories', error)
        );
        this.garmentCategoriesSubject.next([]);
        return throwError(() =>
          this.createApiUnavailableError('loading garment categories', error)
        );
      })
    );
  }

  private loadImagePerspectives(): Observable<ImagePerspectiveDto[]> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Unable to load garment image perspectives from OutfitifyAPI', error);
      this.imagePerspectivesSubject.next([]);
      return throwError(() => error);
    }

    return this.outfitifyApi.listGarmentImagePerspectives().pipe(
      tap((perspectives: ImagePerspectiveDto[]) => {
        this.imagePerspectivesSubject.next(perspectives);
        this.imagePerspectivesLoaded = true;
      }),
      catchError((error: unknown) => {
        console.error(
          'Unable to load garment image perspectives from OutfitifyAPI',
          this.createApiUnavailableError('loading image perspectives', error)
        );
        this.imagePerspectivesSubject.next([]);
        return throwError(() =>
          this.createApiUnavailableError('loading image perspectives', error)
        );
      })
    );
  }

  uploadGarmentImage(
    file: File,
    garmentCategory: GarmentCategoryDto,
    imagePerspectiveId?: number | null
  ): Observable<Garment[]> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Failed to upload garment image', error);
      return throwError(() => error);
    }

    const garmentCategoryEntityId =
      garmentCategory.garmentCategoryEntityId ??
      (garmentCategory as { garmentCategoryEntityID?: number }).garmentCategoryEntityID ??
      null;

    if (!garmentCategoryEntityId) {
      return throwError(() => new Error('Select a garment category before uploading the image.'));
    }

    // OutfitifyAPI expects a minimal multipart payload: file, name, category ID,
    // and optionally the image perspective ID. Extra fields (like the full
    // GarmentCategory object) are rejected by the backend model binder.
    const formData = new FormData();
    formData.append('fileData', file, file.name);
    formData.append('Name', file.name);
    formData.append('GarmentCategoryEntityId', garmentCategoryEntityId.toString());
    formData.append('GarmentCategory', garmentCategoryEntityId.toString());
    if (imagePerspectiveId !== null && imagePerspectiveId !== undefined) {
      formData.append('ImagePerspectiveId', imagePerspectiveId.toString());
    }

    return this.outfitifyApi.uploadGarmentImage(formData).pipe(
      switchMap((_: GarmentImageDto) => {
        this.garmentsLoaded = false;
        return this.loadGarments();
      }),
      catchError((error: unknown) => {
        console.error(
          'Failed to upload garment image',
          this.createApiUnavailableError('uploading a garment image', error)
        );
        return throwError(() =>
          this.createApiUnavailableError('uploading a garment image', error)
        );
      })
    );
  }

  // -----------------------------
  // Gallery helpers
  // -----------------------------

  setCurrentGalleryIndex(index: number): void {
    this.galleryIndexSubject.next(index);
  }

  getGeneratedImageById(id: string): GeneratedImage | undefined {
    return this.generatedImagesSubject.value.find((image) => image.id === id);
  }

  getAdjacentImageId(currentId: string, direction: 1 | -1): string | null {
    const images = this.generatedImagesSubject.value.filter(
      (image) => image.status === 'ready'
    );
    if (!images.length) {
      return null;
    }
    const currentIndex = images.findIndex((image) => image.id === currentId);
    if (currentIndex === -1) {
      return images[0]?.id ?? null;
    }
    const targetIndex = (currentIndex + direction + images.length) % images.length;
    return images[targetIndex]?.id ?? null;
  }

  // -----------------------------
  // Outfit creation
  // -----------------------------

  private getActiveModelImageId(): string | null {
    return this.modelIdSubject.value ?? this.currentUser?.modelImageId ?? null;
  }

  private getActivePoseOptionId(): string | null {
    return this.poseIdSubject.value ?? this.currentUser?.poseOptionId ?? null;
  }

  private getActiveBackgroundOptionId(): string | null {
    return (
      this.backgroundIdSubject.value ?? this.currentUser?.backgroundOptionId ?? null
    );
  }

  createOutfit(): Observable<GeneratedImage> {
    const allGarments = [
      ...this.topGarmentsSubject.value,
      ...this.bottomGarmentsSubject.value,
      ...this.fullBodyGarmentsSubject.value,
      ...this.jacketGarmentsSubject.value,
      ...this.footwearGarmentsSubject.value,
      ...this.accessoriesGarmentsSubject.value
    ];

    if (allGarments.length === 0) {
      throw new Error('Please select at least one garment before creating an outfit.');
    }

    const modelId = this.getActiveModelImageId();

    if (!modelId) {
      throw new Error(
        'No model image is set. Upload a photo (consumer app) or select a model (Shopify app) before creating an outfit.'
      );
    }

    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      return throwError(() => error);
    }

    // Fetch pose if not already loaded, then create outfit
    const poseId = this.getActivePoseOptionId();
    if (poseId) {
      return this.doCreateOutfit(modelId, poseId, allGarments);
    }

    // Pose not loaded yet - fetch it first
    return this.outfitifyApi.listPoses().pipe(
      take(1),
      switchMap((poses: CatalogueOption[]) => {
        const firstPose = poses[0];
        if (!firstPose?.id) {
          return throwError(() => new Error('No poses available. Please contact support.'));
        }
        this.poseIdSubject.next(firstPose.id);
        return this.doCreateOutfit(modelId, firstPose.id, allGarments);
      })
    );
  }

  private doCreateOutfit(
    modelId: string,
    poseId: string,
    allGarments: Garment[]
  ): Observable<GeneratedImage> {
    const outfitGarments: OutfitGarment[] = allGarments.map((garment) => ({
      garmentEntityId: garment.id,
      garmentSizeEntityId: null
    }));

    // Get current pose prompt (if selected from presets)
    const posePrompt = this.posePromptSubject.value;
    // Get custom background prompt (if user typed one)
    const customBackgroundPrompt = this.customBackgroundPromptSubject.value;
    // Get aspect ratio selection
    const aspectRatio = this.aspectRatioSubject.value;

    // Get pose preset name for display purposes
    const posePresetId = this.selectedPosePresetIdSubject.value;
    const posePreset = posePresetId && posePresetId !== 'original'
      ? POSE_PRESETS.find(p => p.id === posePresetId)
      : null;
    const posePresetName = posePreset?.name || null;

    // Get background preset name for display purposes
    const backgroundPresetId = this.selectedBackgroundPresetIdSubject.value;
    const backgroundPreset = backgroundPresetId
      ? BACKGROUND_PROMPT_PRESETS.find(p => p.id === backgroundPresetId)
      : null;
    const backgroundPresetName = backgroundPreset?.name || null;

    // Build payload with all user selections
    const payload: CreateOutfitDto = {
      modelImageId: modelId,
      poseOptionId: poseId,
      backgroundOptionId: null,
      customBackgroundPrompt: customBackgroundPrompt || null,
      backgroundPresetName: backgroundPresetName,
      aspectRatio: aspectRatio || null,
      posePrompt: posePrompt || null,
      posePresetName: posePresetName,
      outfitGarments
    };

    return this.outfitifyApi
      .createOutfitRequest(payload)
      .pipe(
        map((response: OutfitDto) => this.mapOutfitDto(response)),
        tap((generatedImage: GeneratedImage) => {
          const images = this.generatedImagesSubject.value.filter(
            (image) => image.id !== generatedImage.id
          );
          this.generatedImagesSubject.next([generatedImage, ...images]);
        }),
        catchError((error: unknown) =>
          throwError(() => this.createApiUnavailableError('creating an outfit', error))
        )
      );
  }

  /**
   * Creates outfit requests for all selected models.
   * Returns an Observable that emits results with succeeded and failed arrays.
   */
  createOutfits(): Observable<{ succeeded: GeneratedImage[]; failed: string[] }> {
    const selectedModels = this.selectedModelsSubject.value;

    if (selectedModels.length === 0) {
      return throwError(() => new Error('No models selected.'));
    }

    const allGarments = [
      ...this.topGarmentsSubject.value,
      ...this.bottomGarmentsSubject.value,
      ...this.fullBodyGarmentsSubject.value,
      ...this.jacketGarmentsSubject.value,
      ...this.footwearGarmentsSubject.value,
      ...this.accessoriesGarmentsSubject.value
    ];

    if (allGarments.length === 0) {
      return throwError(() => new Error('Please select at least one garment.'));
    }

    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      return throwError(() => error);
    }

    // Get pose
    const poseId = this.getActivePoseOptionId();
    if (!poseId) {
      return this.outfitifyApi.listPoses().pipe(
        take(1),
        switchMap((poses: CatalogueOption[]) => {
          const firstPose = poses[0];
          if (!firstPose?.id) {
            return throwError(() => new Error('No poses available.'));
          }
          this.poseIdSubject.next(firstPose.id);
          return this.doCreateOutfitsForModels(selectedModels, firstPose.id, allGarments);
        })
      );
    }

    return this.doCreateOutfitsForModels(selectedModels, poseId, allGarments);
  }

  private doCreateOutfitsForModels(
    models: SelectedInspiration[],
    poseId: string,
    allGarments: Garment[]
  ): Observable<{ succeeded: GeneratedImage[]; failed: string[] }> {
    const outfitGarments: OutfitGarment[] = allGarments.map((garment) => ({
      garmentEntityId: garment.id,
      garmentSizeEntityId: null
    }));

    const posePrompt = this.posePromptSubject.value;
    const customBackgroundPrompt = this.customBackgroundPromptSubject.value;
    const aspectRatio = this.aspectRatioSubject.value;

    // Get pose preset name for display purposes
    const posePresetId = this.selectedPosePresetIdSubject.value;
    const posePreset = posePresetId && posePresetId !== 'original'
      ? POSE_PRESETS.find(p => p.id === posePresetId)
      : null;
    const posePresetName = posePreset?.name || null;

    // Get background preset name for display purposes
    const backgroundPresetId = this.selectedBackgroundPresetIdSubject.value;
    const backgroundPreset = backgroundPresetId
      ? BACKGROUND_PROMPT_PRESETS.find(p => p.id === backgroundPresetId)
      : null;
    const backgroundPresetName = backgroundPreset?.name || null;

    // Execute sequentially to prevent race conditions with credit balance
    // Using from() + concatMap ensures each request completes before the next starts
    return from(models).pipe(
      concatMap(model => {
        if (!model.id) {
          return of({ success: false as const, error: 'Model has no ID', modelName: model.name });
        }

        const payload: CreateOutfitDto = {
          modelImageId: model.id,
          poseOptionId: poseId,
          backgroundOptionId: null,
          customBackgroundPrompt: customBackgroundPrompt || null,
          backgroundPresetName: backgroundPresetName,
          aspectRatio: aspectRatio || null,
          posePrompt: posePrompt || null,
          posePresetName: posePresetName,
          outfitGarments
        };

        return this.outfitifyApi.createOutfitRequest(payload).pipe(
          map((response: OutfitDto) => ({
            success: true as const,
            image: this.mapOutfitDto(response)
          })),
          catchError(() => of({
            success: false as const,
            error: `Failed for model ${model.name || model.id}`,
            modelName: model.name
          }))
        );
      }),
      toArray(),
      map(results => {
        const succeeded: GeneratedImage[] = [];
        const failed: string[] = [];

        results.forEach(result => {
          if (result.success) {
            succeeded.push(result.image);
          } else {
            failed.push(result.error);
          }
        });

        // Add successful images to gallery
        if (succeeded.length > 0) {
          const existingImages = this.generatedImagesSubject.value;
          const newIds = new Set(succeeded.map(img => img.id));
          const filtered = existingImages.filter(img => !newIds.has(img.id));
          this.generatedImagesSubject.next([...succeeded, ...filtered]);
        }

        return { succeeded, failed };
      })
    );
  }

  refreshGeneratedImages(): Observable<GeneratedImage[]> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Unable to refresh generated outfits', error);
      return of(this.generatedImagesSubject.value);
    }

    return this.outfitifyApi
      .listOutfitRequests()
      .pipe(
        map((items: OutfitDto[]) => items.map((item) => this.mapOutfitDto(item))),
        tap((images: GeneratedImage[]) => this.generatedImagesSubject.next(images)),
        catchError((error: unknown) => {
          console.error(
            'Unable to refresh generated outfits',
            this.createApiUnavailableError('refreshing generated outfits', error)
          );
          return of(this.generatedImagesSubject.value);
        })
      );
  }

  removeGeneratedImage(id: string): void {
    const remaining = this.generatedImagesSubject.value.filter(
      (image) => image.id !== id
    );
    this.generatedImagesSubject.next(remaining);

    const current = this.galleryIndexSubject.value;
    if (current >= remaining.length) {
      this.galleryIndexSubject.next(Math.max(remaining.length - 1, 0));
    }
  }

  // -----------------------------
  // Mapping helpers
  // -----------------------------

  /**
   * Resolves a URL by prepending the API base URL for relative paths.
   * Returns the URL unchanged if it's already absolute or empty.
   */
  private resolveAssetUrl(url: string | null | undefined, fallback?: string): string {
    if (!url) {
      return fallback ?? '';
    }
    // If the URL starts with /, prepend the API base URL
    if (url.startsWith('/')) {
      const baseUrl = (this.apiBaseUrl?.trim() || '').replace(/\/$/, '');
      return baseUrl + url;
    }
    // Already absolute or other format
    return url;
  }

  private mapGarmentSummaryToGarment(dto: GarmentSummaryDto): Garment {
    const fallbackGroup: GarmentGroup = 'accessories';
    const rawGroup =
      dto.category ??
      (dto as { group?: string | null }).group ??
      (dto as { garmentCategoryGroup?: string | null }).garmentCategoryGroup ??
      (dto as { garmentCategory?: string | null }).garmentCategory ??
      null;
    const normalizedGroup =
      typeof rawGroup === 'string'
        ? rawGroup.trim().toLowerCase().replace(/\s+/g, '-')
        : null;
    const allowedGroups: GarmentGroup[] = ['tops', 'bottoms', 'full-body', 'jackets', 'footwear', 'accessories'];
    const group = allowedGroups.includes(normalizedGroup as GarmentGroup)
      ? (normalizedGroup as GarmentGroup)
      : fallbackGroup;

    // Preserve a few alternate/legacy field names for robustness and debugging
    const idFallback =
      (dto as any).id ??
      (dto as any).garmentEntityId ??
      (dto as any).garmentEntityID ??
      (dto as any).GarmentEntityId ??
      null;

    const garmentCategoryEntityId =
      (dto as any).garmentCategoryEntityId ??
      (dto as any).garmentCategoryEntityID ??
      null;

    const garment: Garment & Record<string, any> = {
      id: idFallback ?? (dto as any).id ?? '',
      name: dto.name,
      description: dto.description ?? '',
      group,
      image: this.resolveAssetUrl(dto.imageUrl, 'assets/generated/placeholder-ready-1.svg'),
      sizes: dto.sizes ?? [],
      isTemplate: (dto as any).isTemplate ?? false
    } as Garment & Record<string, any>;

    // Attach any discovered category/entity id on the runtime object for debugging
    if (garmentCategoryEntityId !== null) {
      garment['garmentCategoryEntityId'] = garmentCategoryEntityId;
    }

    return garment;
  }

  private mapOutfitDto(response: OutfitDto): GeneratedImage {
    const isReady = response.status === 'ready' || response.status === 'completed';
    const isFailed = response.status === 'permanently_failed' || response.status === 'failed';
    const isPendingRetry = response.status === 'pending_retry';

    let defaultImage: string;
    if (isReady) {
      defaultImage = 'assets/generated/placeholder-ready-1.svg';
    } else if (isFailed) {
      defaultImage = 'assets/generated/placeholder-failed.svg';
    } else {
      defaultImage = 'assets/generated/placeholder-processing.svg';
    }

    let primaryImageUrl = defaultImage;
    let outfitImageId: string | undefined;
    let variants: OutfitImageVariant[] = [];

    if (response.outfitImages && response.outfitImages.length > 0) {
      // Map all outfit images to variants
      variants = response.outfitImages.map(img => ({
        id: img.id,
        imageUrl: this.resolveAssetUrl(img.assetUrl, defaultImage),
        editType: img.editType ?? null,
        createdAt: img.createdAtUtc ? new Date(img.createdAtUtc) : new Date()
      }));

      // Primary image is the first one (original)
      const primaryImage = response.outfitImages[0];
      primaryImageUrl = this.resolveAssetUrl(primaryImage.assetUrl, defaultImage);
      outfitImageId = primaryImage.id;
    }

    // Determine display status
    let displayStatus: 'processing' | 'ready' | 'failed' | 'pending_retry';
    if (isReady) {
      displayStatus = 'ready';
    } else if (isFailed) {
      displayStatus = 'failed';
    } else if (isPendingRetry) {
      displayStatus = 'pending_retry';
    } else {
      displayStatus = 'processing';
    }

    return {
      id: response.id,
      outfitImageId,
      imageUrl: primaryImageUrl,
      createdAt: response.createdAtUtc ? new Date(response.createdAtUtc) : new Date(),
      status: displayStatus,
      failureReason: response.failureReason,
      variants,
      variantCount: variants.length,
      archivedAtUtc: response.archivedAtUtc,
      // Input details for display
      modelImageUrl: response.modelImageUrl ? this.resolveAssetUrl(response.modelImageUrl) : null,
      poseName: response.poseName,
      backgroundName: response.backgroundName,
      aspectRatio: response.aspectRatio,
      garments: response.garments?.map(g => ({
        id: g.id,
        name: g.name,
        imageUrl: g.imageUrl ? this.resolveAssetUrl(g.imageUrl) : null,
        category: g.category
      }))
    };
  }

  private mapModelImageDtoToInspiration(dto: ModelImageDto): SelectedInspiration {
    const resolvedUrl = this.resolveAssetUrl(dto.imageUrl);
    return {
      previewUrl: resolvedUrl,
      source: 'upload',
      remoteUrl: resolvedUrl,
      id: dto.modelImageId,
      isBackgroundVariant: dto.isBackgroundVariant ?? false,
      name: dto.name,
      isTemplate: dto.isTemplate ?? false
    };
  }

  private mapBackgroundImageDtoToCatalogueOption(
    dto: BackgroundImageDto,
    fallbackThumbnail?: string
  ): CatalogueOption {
    return {
      id: dto.backgroundImageId,
      name: dto.name,
      thumbnailUrl: this.resolveAssetUrl(dto.imageUrl, fallbackThumbnail),
      prompt: dto.prompt,
      isTemplate: dto.isTemplate ?? false
    };
  }
}
