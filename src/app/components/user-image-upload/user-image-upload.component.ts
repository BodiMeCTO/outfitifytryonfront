import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { take, map } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { SelectedInspiration } from '../../models/outfit';
import { CatalogueOption } from '../../models/outfitify-api';

// Icon mapping for template backgrounds
const TEMPLATE_ICONS: Record<string, string> = {
  'White Studio': 'photo_camera',
  'Urban Street': 'location_city',
  'Beach Sunset': 'beach_access',
  'Modern Office': 'business',
  'Nature Park': 'park',
  'Luxury Interior': 'hotel'
};

@Component({
  standalone: true,
  selector: 'app-user-image-upload',
  imports: [
    CommonModule,
    NgIf,
    AsyncPipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    RouterLink
  ],
  templateUrl: './user-image-upload.component.html',
  styleUrls: ['./user-image-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserImageUploadComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly snackBar = inject(MatSnackBar);

  // Model image state
  readonly inspiration$ = this.outfitService.selectedInspiration$;
  readonly userImages$ = this.outfitService.userModelImages$;
  readonly isUploading = signal(false);

  // Background image state
  readonly backgroundOptions$ = this.outfitService.backgroundOptions$;
  readonly selectedBackground$ = this.outfitService.selectedBackground$;
  readonly customPrompt$ = this.outfitService.customBackgroundPrompt$;

  // Only show template backgrounds
  readonly templateBackgrounds$ = this.backgroundOptions$.pipe(
    map(options => options.filter(o => o.isTemplate))
  );

  // Track if custom prompt mode is active
  readonly isCustomMode = signal(false);
  customPromptValue = '';

  // Track if "Keep Original" is selected (default)
  readonly isKeepOriginal = signal(true);

  ngOnInit(): void {
    // Load model images
    this.outfitService
      .ensureUserModelImagesLoaded()
      .pipe(take(1))
      .subscribe({
        error: (err) => console.error('Failed to load user model images', err)
      });

    // Load background options
    this.outfitService
      .ensureBackgroundOptionsLoaded()
      .pipe(take(1))
      .subscribe({
        error: () => {
          this.snackBar.open('Unable to load background options right now.', 'Dismiss', {
            duration: 3500
          });
        }
      });
  }

  handleFileSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select an image file to upload.', 'Dismiss', {
        duration: 4000
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = reader.result as string;
      this.isUploading.set(true);
      this.outfitService
        .uploadAndSetInspiration(file, previewUrl)
        .pipe(take(1))
        .subscribe({
          next: (selection: SelectedInspiration) => {
            this.isUploading.set(false);
            this.snackBar.open('Image of the person uploaded successfully.', 'Great!', {
              duration: 2500
            });
            if (!selection.remoteUrl) {
              this.snackBar.open(
                'OutfitifyAPI accepted your image but did not return a URL; your local photo will be used.',
                'OK',
                { duration: 4000 }
              );
            }
          },
          error: () => {
            this.isUploading.set(false);
            this.snackBar.open(
              'Unable to upload your image to OutfitifyAPI right now.',
              'Dismiss',
              { duration: 4000 }
            );
          }
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  selectExisting(inspiration: SelectedInspiration): void {
    this.outfitService.setInspiration(inspiration);

    if (inspiration.id) {
      this.outfitService.setSelectedModel({ id: inspiration.id });
    }

    this.snackBar.open('Using your saved photo.', undefined, { duration: 1500 });
  }

  clearSelection(): void {
    this.outfitService.setInspiration(null);
  }

  // Background methods
  selectKeepOriginal(): void {
    this.isKeepOriginal.set(true);
    this.isCustomMode.set(false);
    this.customPromptValue = '';
    this.outfitService.setSelectedBackground(null);
    this.outfitService.setCustomBackgroundPrompt(null);
    this.snackBar.open('Using original background from your photo.', undefined, { duration: 1500 });
  }

  selectExistingBackground(option: CatalogueOption): void {
    this.isKeepOriginal.set(false);
    this.isCustomMode.set(false);
    this.customPromptValue = '';
    this.outfitService.setSelectedBackground(option);
    this.snackBar.open('Using this background.', undefined, { duration: 1500 });
  }

  selectCustomMode(): void {
    this.isKeepOriginal.set(false);
    this.isCustomMode.set(true);
    this.outfitService.setSelectedBackground(null);
  }

  applyCustomPrompt(): void {
    if (this.customPromptValue.trim()) {
      this.outfitService.setCustomBackgroundPrompt(this.customPromptValue.trim());
      this.snackBar.open('Custom background prompt set.', undefined, { duration: 1500 });
    }
  }

  clearBackgroundSelection(): void {
    // Reset to default "Keep Original"
    this.isKeepOriginal.set(true);
    this.isCustomMode.set(false);
    this.customPromptValue = '';
    this.outfitService.setSelectedBackground(null);
    this.outfitService.setCustomBackgroundPrompt(null);
  }

  getTemplateIcon(name: string): string {
    return TEMPLATE_ICONS[name] || 'image';
  }
}
