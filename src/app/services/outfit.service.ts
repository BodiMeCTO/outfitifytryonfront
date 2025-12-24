import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  of,
  throwError,
  forkJoin
} from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  tap,
  switchMap,
  take
} from 'rxjs/operators';

import {
  Garment,
  GarmentGroup,
  GeneratedImage,
  OutfitRequest,
  OutfitRequestSnapshot,
  SelectedInspiration,
  CreateOutfitDto,
  OutfitDto
} from '../models/outfit';

import {
  GarmentSummaryDto,
  CreateGarmentInstanceRequest,
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
  id: string;
  name: string;
  imageUrl: string;
  poseOptionId: string;
  notes: string | null;
  isActive: boolean;
  createdAtUtc: string | null;
}

export interface CreateModelImageDto {
  name: string;
  poseOptionId?: string | null;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OutfitService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  // --- Core selection state ---

  private readonly inspirationSubject = new BehaviorSubject<SelectedInspiration | null>(
    null
  );

  // All model images the user has uploaded
  private readonly userModelImagesSubject = new BehaviorSubject<SelectedInspiration[]>(
    []
  );
  private userModelImagesLoaded = false;

  private readonly topGarmentSubject = new BehaviorSubject<Garment | null>(null);
  private readonly bottomGarmentSubject = new BehaviorSubject<Garment | null>(null);
  private readonly fullBodyGarmentSubject = new BehaviorSubject<Garment | null>(null);

  private readonly topSizeSubject = new BehaviorSubject<string | null>(null);
  private readonly bottomSizeSubject = new BehaviorSubject<string | null>(null);
  private readonly fullBodySizeSubject = new BehaviorSubject<string | null>(null);

  // Model image / pose / background
  // modelIdSubject now holds the ModelImageId (user upload)
  private readonly modelIdSubject = new BehaviorSubject<string | null>(null);
  private readonly poseIdSubject = new BehaviorSubject<string | null>(null);
  private readonly backgroundIdSubject = new BehaviorSubject<string | null>(null);
  private readonly backgroundOptionsSubject = new BehaviorSubject<CatalogueOption[]>([]);
  private backgroundOptionsLoaded = false;

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
    const clientChanged = this.currentUser?.clientId !== user?.clientId;
    this.currentUser = user;

    if (!user) {
      this.modelIdSubject.next(null);
      this.poseIdSubject.next(null);
      this.backgroundIdSubject.next(null);
      this.backgroundOptionsLoaded = false;
      this.backgroundOptionsSubject.next([]);
      return;
    }

    if (user.modelImageId) {
      this.modelIdSubject.next(user.modelImageId);
    }

    if (user.poseOptionId) {
      this.poseIdSubject.next(user.poseOptionId);
    }

    if (clientChanged) {
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

  // Saved model images for current user
  readonly userModelImages$ = this.userModelImagesSubject.asObservable();

  readonly selectedTop$ = this.topGarmentSubject.asObservable();
  readonly selectedBottom$ = this.bottomGarmentSubject.asObservable();
  readonly selectedFullBody$ = this.fullBodyGarmentSubject.asObservable();

  readonly selectedTopSize$ = this.topSizeSubject.asObservable();
  readonly selectedBottomSize$ = this.bottomSizeSubject.asObservable();
  readonly selectedFullBodySize$ = this.fullBodySizeSubject.asObservable();

  readonly selectedModelId$ = this.modelIdSubject.asObservable();
  readonly selectedPoseId$ = this.poseIdSubject.asObservable();
  readonly selectedBackgroundId$ = this.backgroundIdSubject.asObservable();
  readonly backgroundOptions$ = this.backgroundOptionsSubject.asObservable();

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
    this.selectedFullBody$
  ]).pipe(
    map(([top, bottom, fullBody]) => ({
      top,
      bottom,
      fullBody
    }))
  );

  readonly selectedSizes$ = combineLatest([
    this.selectedTopSize$,
    this.selectedBottomSize$,
    this.selectedFullBodySize$
  ]).pipe(
    map(([top, bottom, fullBody]) => ({
      top,
      bottom,
      fullBody
    }))
  );

  readonly garments$ = this.garmentsSubject.asObservable();
  readonly garmentCategories$ = this.garmentCategoriesSubject.asObservable();
  readonly imagePerspectives$ = this.imagePerspectivesSubject.asObservable();

  // âœ… These two are what `garment-library.component.ts` expects
  readonly hasCompleteGarmentSelection$ = this.selectedGarments$.pipe(
    map((garments) => {
      const hasFullBody = !!garments.fullBody;
      const hasTopBottom = !!(garments.top && garments.bottom);
      const invalidMix = !!(garments.fullBody && (garments.top || garments.bottom));

      return !invalidMix && (hasFullBody || hasTopBottom);
    }),
    distinctUntilChanged()
  );

  readonly hasCompleteSelection$ = combineLatest([
    this.selectedGarments$,
    this.selectedSizes$
  ]).pipe(
    map(([garments, sizes]) => {
      const hasFullBody = !!(garments.fullBody && sizes.fullBody);
      const hasTopBottom =
        !!garments.top && !!garments.bottom && !!sizes.top && !!sizes.bottom;
      const invalidMix = !!(garments.fullBody && (garments.top || garments.bottom));

      return !invalidMix && (hasFullBody || hasTopBottom);
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
  // User model images (/api/model-images)
  // -----------------------------

  ensureUserModelImagesLoaded(): Observable<SelectedInspiration[]> {
    if (this.userModelImagesLoaded) {
      return of(this.userModelImagesSubject.value);
    }
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

  // -----------------------------
  // Upload /api/model-images/upload
  // -----------------------------

uploadAndSetInspiration(
  file: File,
  previewUrl: string
): Observable<SelectedInspiration> {
  try {
    this.getApiBaseUrlOrThrow();
  } catch (error) {
    console.error('Failed to upload model image', error);

    const selection: SelectedInspiration = {
      file,
      previewUrl,
      source: 'upload'
    };
    this.setInspiration(selection);
    return of(selection);
  }

  const poseOptionId = this.poseIdSubject.value;
  if (!poseOptionId) {
    const selection: SelectedInspiration = {
      file,
      previewUrl,
      source: 'upload'
    };
    this.setInspiration(selection);
    return of(selection);
  }

  const formData = new FormData();
  formData.append('fileData', file, file.name);

  // Must match CreateModelImageDto property names
  formData.append('Name', file.name);
  formData.append('PoseOptionId', poseOptionId);

  return this.outfitifyApi
    .uploadModelImage(formData)
    .pipe(
      map((response: ModelImageDto) => {
        const selection: SelectedInspiration = {
          file,
          previewUrl,
          source: 'upload',
          remoteUrl: response.imageUrl,
          id: response.id
        };

        this.modelIdSubject.next(response.id);
        return selection;
      }),
      tap((selection) => {
        this.setInspiration(selection);

        if (selection.id) {
          const current = this.userModelImagesSubject.value;
          const exists = current.some((img) => img.id === selection.id);
          if (!exists) {
            this.userModelImagesSubject.next([...current, selection]);
          }
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

  setSelectedGarment(group: GarmentGroup, garment: Garment | null): void {
    let garmentSubject: BehaviorSubject<Garment | null>;
    let sizeSubject: BehaviorSubject<string | null>;

    switch (group) {
      case 'tops':
        garmentSubject = this.topGarmentSubject;
        sizeSubject = this.topSizeSubject;
        break;
      case 'bottoms':
        garmentSubject = this.bottomGarmentSubject;
        sizeSubject = this.bottomSizeSubject;
        break;
      case 'full-body':
        garmentSubject = this.fullBodyGarmentSubject;
        sizeSubject = this.fullBodySizeSubject;
        break;
      default:
        return;
    }

    const previous = garmentSubject.value;
    garmentSubject.next(garment);

    if (!garment || !previous || garment.id !== previous.id) {
      sizeSubject.next(null);
    }
  }

  setSelectedSize(group: GarmentGroup, size: string | null): void {
    switch (group) {
      case 'tops':
        this.topSizeSubject.next(size);
        break;
      case 'bottoms':
        this.bottomSizeSubject.next(size);
        break;
      case 'full-body':
        this.fullBodySizeSubject.next(size);
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

  uploadBackgroundOption(file: File, previewUrl: string): Observable<CatalogueOption> {
    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      console.error('Failed to upload background image', error);

      const fallbackOption: CatalogueOption = {
        id: `local-background-${Date.now()}`,
        name: file.name,
        thumbnailUrl: previewUrl
      };

      this.setSelectedBackground(fallbackOption);
      this.backgroundOptionsSubject.next([...this.backgroundOptionsSubject.value, fallbackOption]);

      return of(fallbackOption);
    }

    const formData = new FormData();
    formData.append('fileData', file, file.name);
    formData.append('Name', file.name);
    formData.append('EnvironmentType', 'Custom');
    formData.append('IsActive', 'true');

    return this.outfitifyApi.uploadBackgroundImage(formData).pipe(
      map((dto: BackgroundImageDto) => this.mapBackgroundImageDtoToCatalogueOption(dto, previewUrl)),
      tap((option) => {
        this.setSelectedBackground(option);

        const current = this.backgroundOptionsSubject.value;
        const exists = current.some((item) => item.id === option.id);
        if (!exists) {
          this.backgroundOptionsSubject.next([...current, option]);
        }
      }),
      catchError((error: unknown) => {
        console.error('Failed to upload background image', error);

        const fallbackOption: CatalogueOption = {
          id: `local-background-${Date.now()}`,
          name: file.name,
          thumbnailUrl: previewUrl
        };

        this.setSelectedBackground(fallbackOption);
        this.backgroundOptionsSubject.next([...this.backgroundOptionsSubject.value, fallbackOption]);
        return of(fallbackOption);
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
        // Debug log to help diagnose mismatches between backend DB and frontend
        // (leave this in temporarily while troubleshooting).
        try {
          console.debug('[OutfitService] loadGarmentCategories: received', categories?.length ?? 0, 'categories', categories);
        } catch (e) {
          // ignore logging errors
        }
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
  // Garment instance helper
  // -----------------------------

  private ensureGarmentInstancesForSelection(
    garments: {
      top: Garment | null;
      bottom: Garment | null;
      fullBody: Garment | null;
    },
    sizes: {
      top: string | null;
      bottom: string | null;
      fullBody: string | null;
    }
  ): Observable<string[]> {
    const requests: Observable<string>[] = [];

    const add = (garment: Garment | null, size: string | null) => {
      if (!garment || !size) return;

      const payload: CreateGarmentInstanceRequest = {
        garmentEntityId: garment.id,
        sizeName: size
      };

      const req$ = this.outfitifyApi
        .createGarmentInstance(payload)
        .pipe(map((dto) => dto.id));

      requests.push(req$);
    };

    add(garments.fullBody, sizes.fullBody);
    add(garments.top, sizes.top);
    add(garments.bottom, sizes.bottom);

    if (requests.length === 0) {
      return of([]);
    }

    return forkJoin(requests);
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
    const garments = {
      top: this.topGarmentSubject.value,
      bottom: this.bottomGarmentSubject.value,
      fullBody: this.fullBodyGarmentSubject.value
    };

    const sizes = {
      top: this.topSizeSubject.value,
      bottom: this.bottomSizeSubject.value,
      fullBody: this.fullBodySizeSubject.value
    };

    const hasFullBody = !!(garments.fullBody && sizes.fullBody);
    const hasTopBottom =
      !!(garments.top && garments.bottom && sizes.top && sizes.bottom);
    const invalidMix =
      !!(garments.fullBody && (garments.top || garments.bottom));

    if (invalidMix) {
      throw new Error(
        'You cannot combine a full-body garment with a separate top or bottom.'
      );
    }

    if (!hasFullBody && !hasTopBottom) {
      throw new Error(
        'Select either a full-body garment and size, or a top and bottom with sizes, before creating an outfit.'
      );
    }

    const modelId = this.getActiveModelImageId();
    const poseId = this.getActivePoseOptionId();
    const backgroundId = this.getActiveBackgroundOptionId();

    if (!modelId) {
      throw new Error(
        'No model image is set. Upload a photo (consumer app) or select a model (Shopify app) before creating an outfit.'
      );
    }

    if (!poseId || !backgroundId) {
      throw new Error(
        'Pose or background is not available yet. Please try again in a moment.'
      );
    }

    try {
      this.getApiBaseUrlOrThrow();
    } catch (error) {
      return throwError(() => error);
    }

    return this.ensureGarmentInstancesForSelection(garments, sizes).pipe(
      switchMap((garmentInstanceIds) => {
        const payload: CreateOutfitDto = {
          garmentInstanceIds,
          modelImageId: modelId,
          poseOptionId: poseId,
          backgroundOptionId: backgroundId,
          garmentInstances: null
        };

        return this.outfitifyApi
          .createOutfitRequest(payload)
          .pipe(map((response: OutfitDto) => this.mapOutfitDto(response)));
      }),
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

  private mapGarmentSummaryToGarment(dto: GarmentSummaryDto): Garment {
    const fallbackGroup: GarmentGroup = 'full-body';
    // Resolve id from several possible field names (some backends use different keys)
    const resolvedId =
      (dto as any).id ?? (dto as any).garmentEntityId ?? (dto as any).garmentId ?? undefined;

    // Determine rawGroup from DTO string fields if present
    let rawGroup =
      (dto as any).category ??
      (dto as any).group ??
      (dto as any).garmentCategoryGroup ??
      (dto as any).garmentCategory ??
      null;
    let normalizedGroup =
      typeof rawGroup === 'string'
        ? rawGroup.trim().toLowerCase().replace(/\s+/g, '-')
        : null;
    // If the DTO did not include a textual group, try to resolve it by the
    // numeric garment category entity id (foreign key) using cached categories.
    if (!normalizedGroup) {
      const catEntityId = (dto as any).garmentCategoryEntityId ?? (dto as any).garmentCategoryEntityID ?? null;
      if (catEntityId != null) {
        const cats = this.garmentCategoriesSubject.value || [];
        const match = cats.find(
          (c) => (c.garmentCategoryEntityId ?? (c as any).garmentCategoryEntityID) === catEntityId
        );
        if (match) {
          rawGroup = match.group ?? match.category ?? rawGroup;
          // recompute normalizedGroup from matched category
          normalizedGroup = typeof rawGroup === 'string' ? rawGroup.trim().toLowerCase().replace(/\s+/g, '-') : null;
        }
      }
    }

    const allowedGroups: GarmentGroup[] = ['tops', 'bottoms', 'full-body'];
    let group = allowedGroups.includes(normalizedGroup as GarmentGroup)
      ? (normalizedGroup as GarmentGroup)
      : fallbackGroup;

    const garment: Garment = {
      id: resolvedId ?? dto.id ?? String(Date.now()),
      name: dto.name,
      description: dto.description ?? '',
      group,
      image: dto.imageUrl ?? 'assets/generated/placeholder-ready-1.svg',
      sizes: dto.sizes ?? []
    };

    try {
      console.log('[OutfitService] mapped garment DTO -> front model', {
        dto: {
          id: resolvedId ?? dto.id,
          category: (dto as any).category ?? (dto as any).garmentCategory ?? null,
          group: (dto as any).group ?? (dto as any).garmentCategoryGroup ?? null,
          garmentCategoryEntityId: (dto as any).garmentCategoryEntityId ?? (dto as any).garmentCategoryEntityID ?? null
        },
        normalizedGroup,
        resolvedGroup: group,
        garment
      });
    } catch (e) {
      // ignore logging errors
    }

    return garment;
  }

  private mapOutfitDto(response: OutfitDto): GeneratedImage {
    const isReady = response.status === 'ready' || response.status === 'completed';
    const defaultImage = isReady
      ? 'assets/generated/placeholder-ready-1.svg'
      : 'assets/generated/placeholder-processing.svg';

    const primaryImageUrl =
      response.outfitImages && response.outfitImages.length > 0
        ? response.outfitImages[0].assetUrl
        : defaultImage;

    return {
      id: response.id,
      imageUrl: primaryImageUrl,
      createdAt: response.createdAtUtc ? new Date(response.createdAtUtc) : new Date(),
      status: isReady ? 'ready' : 'processing'
    };
  }

  private mapModelImageDtoToInspiration(dto: ModelImageDto): SelectedInspiration {
    return {
      previewUrl: dto.imageUrl,
      source: 'upload',
      remoteUrl: dto.imageUrl,
      id: dto.id
    };
  }

  private mapBackgroundImageDtoToCatalogueOption(
    dto: BackgroundImageDto,
    fallbackThumbnail?: string
  ): CatalogueOption {
    return {
      id: dto.backgroundImageId,
      name: dto.name,
      thumbnailUrl: dto.imageUrl ?? fallbackThumbnail
    };
  }
}
