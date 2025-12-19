import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs/operators';

import { OutfitService } from '../../services/outfit.service';
import { CatalogueOption } from '../../models/outfitify-api';

@Component({
  standalone: true,
  selector: 'app-background-image-upload',
  imports: [
    CommonModule,
    NgIf,
    AsyncPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressBarModule,
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
  readonly isUploading = signal(false);

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
        .uploadBackgroundOption(file, previewUrl)
        .pipe(take(1))
        .subscribe({
          next: (option: CatalogueOption) => {
            this.isUploading.set(false);
            this.snackBar.open('Background uploaded successfully.', 'Great!', {
              duration: 2500
            });

            if (!option.thumbnailUrl) {
              this.snackBar.open(
                'Background uploaded without a preview URL; using your local image.',
                'OK',
                { duration: 4000 }
              );
            }
          },
          error: () => {
            this.isUploading.set(false);
            this.snackBar.open(
              'Unable to upload your background right now.',
              'Dismiss',
              { duration: 4000 }
            );
          }
        });
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  selectExisting(option: CatalogueOption): void {
    this.outfitService.setSelectedBackground(option);
    this.snackBar.open('Using this background.', undefined, { duration: 1500 });
  }

  clearSelection(): void {
    this.outfitService.setSelectedBackground(null);
  }
}
