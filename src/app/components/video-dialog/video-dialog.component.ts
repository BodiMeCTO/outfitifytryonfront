import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { take } from 'rxjs/operators';

import { VideoService, VideoDto, MotionPresetDto, CreateVideoRequest } from '../../services/video.service';

export interface VideoDialogData {
  outfitId: string;
  outfitImageId: string;
  imageUrl: string;
  userCredits: number;
}

export interface VideoDialogResult {
  created: boolean;
  video?: VideoDto;
}

type VideoStatus = 'options' | 'creating' | 'processing' | 'ready' | 'error';

@Component({
  selector: 'app-video-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './video-dialog.component.html',
  styleUrls: ['./video-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<VideoDialogComponent>);
  readonly videoService = inject(VideoService); // Public for template access
  private readonly snackBar = inject(MatSnackBar);
  readonly data: VideoDialogData = inject(MAT_DIALOG_DATA);

  // Options state
  readonly isLoadingOptions = signal(true);
  readonly motionPresets = signal<MotionPresetDto[]>([]);

  // Selected options
  readonly selectedDuration = signal<5 | 10>(5);
  readonly selectedResolution = signal<'480p' | '720p' | '1080p'>('480p');
  readonly selectedPreset = signal<string>('natural_movement');
  readonly customPrompt = signal<string>('');

  // Processing state
  readonly status = signal<VideoStatus>('options');
  readonly currentVideo = signal<VideoDto | null>(null);
  readonly errorMessage = signal<string>('');

  // Computed: credit cost
  readonly creditCost = computed(() => {
    return this.videoService.getCreditCost(this.selectedDuration(), this.selectedResolution());
  });

  // Computed: can afford
  readonly canAfford = computed(() => {
    return this.data.userCredits >= this.creditCost();
  });

  // Computed: is custom preset
  readonly isCustomPreset = computed(() => {
    return this.selectedPreset() === 'custom';
  });

  // Duration options
  readonly durationOptions = [
    { value: 5 as const, label: '5 seconds', description: 'Quick preview' },
    { value: 10 as const, label: '10 seconds', description: 'Extended clip' }
  ];

  // Resolution options
  readonly resolutionOptions = [
    { value: '480p' as const, label: '480p', description: 'Standard' },
    { value: '720p' as const, label: '720p', description: 'HD' },
    { value: '1080p' as const, label: '1080p', description: 'Full HD' }
  ];

  ngOnInit(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.videoService.getOptions(this.data.outfitId).pipe(take(1)).subscribe({
      next: (options) => {
        this.motionPresets.set(options.motionPresets);
        this.isLoadingOptions.set(false);
      },
      error: (err) => {
        console.error('Failed to load video options:', err);
        this.snackBar.open('Failed to load video options', 'Dismiss', { duration: 3000 });
        this.dialogRef.close({ created: false });
      }
    });
  }

  selectDuration(duration: 5 | 10): void {
    this.selectedDuration.set(duration);
  }

  selectResolution(resolution: '480p' | '720p' | '1080p'): void {
    this.selectedResolution.set(resolution);
  }

  selectPreset(presetId: string): void {
    this.selectedPreset.set(presetId);
  }

  createVideo(): void {
    if (!this.canAfford()) {
      this.snackBar.open('Insufficient credits', 'Dismiss', { duration: 3000 });
      return;
    }

    if (this.isCustomPreset() && !this.customPrompt().trim()) {
      this.snackBar.open('Please enter a custom motion description', 'Dismiss', { duration: 3000 });
      return;
    }

    this.status.set('creating');

    const request: CreateVideoRequest = {
      outfitImageId: this.data.outfitImageId,
      durationSeconds: this.selectedDuration(),
      resolution: this.selectedResolution(),
      motionPreset: this.selectedPreset(),
      customMotionPrompt: this.isCustomPreset() ? this.customPrompt() : undefined
    };

    this.videoService.createVideo(this.data.outfitId, request).pipe(take(1)).subscribe({
      next: (video) => {
        this.currentVideo.set(video);
        this.status.set('processing');
        this.startPolling(video.id);
      },
      error: (err) => {
        console.error('Failed to create video:', err);
        this.status.set('error');
        this.errorMessage.set(err.error?.error || 'Failed to create video');
      }
    });
  }

  private startPolling(videoId: string): void {
    this.videoService.pollVideo(this.data.outfitId, videoId, 3000).subscribe({
      next: (video) => {
        this.currentVideo.set(video);
        if (video.status === 'ready') {
          this.status.set('ready');
        } else if (video.status === 'failed' || video.status === 'permanently_failed') {
          this.status.set('error');
          this.errorMessage.set(video.failureReason || 'Video generation failed');
        }
      },
      error: (err) => {
        console.error('Polling error:', err);
        this.status.set('error');
        this.errorMessage.set('Lost connection while processing');
      }
    });
  }

  downloadVideo(): void {
    const video = this.currentVideo();
    if (!video?.videoUrl) return;

    const fullUrl = this.videoService.getFullVideoUrl(video.videoUrl);
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = `outfitify-video-${video.id}.mp4`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  close(): void {
    const video = this.currentVideo();
    this.dialogRef.close({
      created: video?.status === 'ready',
      video: video?.status === 'ready' ? video : undefined
    } as VideoDialogResult);
  }

  retry(): void {
    this.status.set('options');
    this.errorMessage.set('');
    this.currentVideo.set(null);
  }

  getPresetIcon(presetId: string): string {
    const icons: Record<string, string> = {
      'model_walk': 'directions_walk',
      'runway_spin': 'rotate_right',
      'natural_movement': 'accessibility_new',
      'pose_shift': 'swap_horiz',
      'hair_wind': 'air',
      'custom': 'edit'
    };
    return icons[presetId] || 'videocam';
  }
}
