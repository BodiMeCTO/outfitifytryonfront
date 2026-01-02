import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { take, map } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
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
  selector: 'app-background-image-upload',
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
    RouterLink
  ],
  templateUrl: './background-image-upload.component.html',
  styleUrls: ['./background-image-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackgroundImageUploadComponent implements OnInit {
  private readonly outfitService = inject(OutfitService);
  private readonly snackBar = inject(MatSnackBar);

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

  ngOnInit(): void {
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

  selectExisting(option: CatalogueOption): void {
    this.isCustomMode.set(false);
    this.customPromptValue = '';
    this.outfitService.setSelectedBackground(option);
    this.snackBar.open('Using this background.', undefined, { duration: 1500 });
  }

  selectCustomMode(): void {
    this.isCustomMode.set(true);
    this.outfitService.setSelectedBackground(null);
  }

  applyCustomPrompt(): void {
    if (this.customPromptValue.trim()) {
      this.outfitService.setCustomBackgroundPrompt(this.customPromptValue.trim());
      this.snackBar.open('Custom background prompt set.', undefined, { duration: 1500 });
    }
  }

  clearSelection(): void {
    this.isCustomMode.set(false);
    this.customPromptValue = '';
    this.outfitService.setSelectedBackground(null);
    this.outfitService.setCustomBackgroundPrompt(null);
  }

  getTemplateIcon(name: string): string {
    return TEMPLATE_ICONS[name] || 'image';
  }
}
