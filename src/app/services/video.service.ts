import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, switchMap, takeWhile, map, tap, finalize } from 'rxjs';
import { environment } from '../../environments/environment';

// DTOs matching the API
export interface VideoPricingDto {
  durationSeconds: number;
  resolution: string;
  creditCost: number;
  description: string;
}

export interface MotionPresetDto {
  id: string;
  name: string;
  description: string;
  prompt: string | null;
}

export interface VideoOptionsDto {
  pricing: VideoPricingDto[];
  motionPresets: MotionPresetDto[];
}

export interface CreateVideoRequest {
  outfitImageId?: string;
  durationSeconds: number;
  resolution: string;
  motionPreset: string;
  customMotionPrompt?: string;
}

export interface VideoDto {
  id: string;
  outfitId: string;
  outfitImageId: string;
  durationSeconds: number;
  resolution: string;
  motionPreset: string | null;
  creditCost: number;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'permanently_failed';
  failureReason: string | null;
  videoUrl: string | null;
  fileSizeBytes: number | null;
  createdAtUtc: string;
  completedAtUtc: string | null;
}

@Injectable({ providedIn: 'root' })
export class VideoService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  // Cached options (pricing + presets)
  private cachedOptions: VideoOptionsDto | null = null;

  // Active polling state
  readonly isPolling = signal(false);

  /**
   * Get video generation options (pricing and motion presets).
   * Results are cached after first fetch.
   */
  getOptions(outfitId: string): Observable<VideoOptionsDto> {
    if (this.cachedOptions) {
      return new Observable(observer => {
        observer.next(this.cachedOptions!);
        observer.complete();
      });
    }

    const url = `${this.apiBaseUrl}api/outfits/${outfitId}/videos/options`;
    return this.http.get<VideoOptionsDto>(url).pipe(
      tap(options => {
        this.cachedOptions = options;
      })
    );
  }

  /**
   * Get all videos for an outfit.
   */
  getVideos(outfitId: string): Observable<VideoDto[]> {
    const url = `${this.apiBaseUrl}api/outfits/${outfitId}/videos`;
    return this.http.get<VideoDto[]>(url);
  }

  /**
   * Get a specific video by ID.
   */
  getVideo(outfitId: string, videoId: string): Observable<VideoDto> {
    const url = `${this.apiBaseUrl}api/outfits/${outfitId}/videos/${videoId}`;
    return this.http.get<VideoDto>(url);
  }

  /**
   * Create a new video from an outfit image.
   */
  createVideo(outfitId: string, request: CreateVideoRequest): Observable<VideoDto> {
    const url = `${this.apiBaseUrl}api/outfits/${outfitId}/videos`;
    return this.http.post<VideoDto>(url, request);
  }

  /**
   * Poll a video until it's ready or fails.
   * Returns an observable that emits each status update and completes when done.
   */
  pollVideo(outfitId: string, videoId: string, intervalMs: number = 3000): Observable<VideoDto> {
    this.isPolling.set(true);

    return interval(intervalMs).pipe(
      switchMap(() => this.getVideo(outfitId, videoId)),
      takeWhile(video => video.status === 'queued' || video.status === 'processing', true),
      finalize(() => this.isPolling.set(false))
    );
  }

  /**
   * Calculate credit cost for a video configuration.
   * Uses cached pricing if available, otherwise makes a reasonable estimate.
   */
  getCreditCost(durationSeconds: number, resolution: string): number {
    if (this.cachedOptions) {
      const pricing = this.cachedOptions.pricing.find(
        p => p.durationSeconds === durationSeconds && p.resolution === resolution
      );
      if (pricing) return pricing.creditCost;
    }

    // Fallback estimates based on $0.05 = 1 credit
    const costs: Record<string, Record<string, number>> = {
      '5': { '480p': 2, '720p': 4, '1080p': 7 },
      '10': { '480p': 5, '720p': 9, '1080p': 15 }
    };
    return costs[durationSeconds.toString()]?.[resolution] ?? 2;
  }

  /**
   * Get the full video URL (handle relative URLs).
   */
  getFullVideoUrl(videoUrl: string): string {
    if (videoUrl.startsWith('http')) {
      return videoUrl;
    }
    // Remove leading slash if present
    const path = videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl;
    return `${this.apiBaseUrl}${path}`;
  }
}
