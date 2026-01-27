import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';

import { OutfitifyApiService } from '../../services/outfitify-api.service';
import { ModelImageDto, OutfitService } from '../../services/outfit.service';
import { GarmentSummaryDto } from '../../models/outfitify-api';
import { environment } from '../../../environments/environment';

interface ArchivedModelImage {
  modelImageId: string;
  name: string;
  imageUrl: string;
  archivedAtUtc: string;
}

interface ArchivedGarment {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  archivedAtUtc: string;
}

interface ArchivedOutfit {
  id: string;
  imageUrl: string;
  createdAt: string;
  archivedAtUtc: string;
}

@Component({
  standalone: true,
  selector: 'app-archive-page',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './archive-page.component.html',
  styleUrls: ['./archive-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArchivePageComponent implements OnInit {
  private readonly apiService = inject(OutfitifyApiService);
  private readonly outfitService = inject(OutfitService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly archivedModelImages = signal<ArchivedModelImage[]>([]);
  readonly archivedGarments = signal<ArchivedGarment[]>([]);
  readonly archivedOutfits = signal<ArchivedOutfit[]>([]);
  readonly isLoadingModelImages = signal(false);
  readonly isLoadingGarments = signal(false);
  readonly isLoadingOutfits = signal(false);
  readonly isUnarchiving = signal(false);

  ngOnInit(): void {
    this.loadArchivedItems();
  }

  goBack(): void {
    this.router.navigate(['/generated-gallery']);
  }

  loadArchivedItems(): void {
    this.loadArchivedModelImages();
    this.loadArchivedGarments();
    this.loadArchivedOutfits();
  }

  private loadArchivedModelImages(): void {
    this.isLoadingModelImages.set(true);
    this.apiService.listModelImages(undefined, true).pipe(take(1)).subscribe({
      next: (items: ModelImageDto[]) => {
        const archived = items
          .filter(item => item.archivedAtUtc)
          .map(item => ({
            modelImageId: item.modelImageId,
            name: item.name || 'Unnamed',
            imageUrl: this.resolveAssetUrl(item.imageUrl),
            archivedAtUtc: item.archivedAtUtc!
          }));
        this.archivedModelImages.set(archived);
        this.isLoadingModelImages.set(false);
      },
      error: () => {
        this.isLoadingModelImages.set(false);
        this.snackBar.open('Failed to load archived model images', 'Dismiss', { duration: 3000 });
      }
    });
  }

  private loadArchivedGarments(): void {
    this.isLoadingGarments.set(true);
    this.apiService.listGarments(true).pipe(take(1)).subscribe({
      next: (items: GarmentSummaryDto[]) => {
        const archived = items
          .filter(item => item.archivedAtUtc || (item as any).ArchivedAtUtc)
          .map(item => {
            const rawItem = item as any;
            return {
              id: item.id || rawItem.garmentEntityId || rawItem.GarmentEntityId,
              name: item.name || rawItem.Name || 'Unnamed',
              imageUrl: this.resolveAssetUrl(item.imageUrl || rawItem.ImageUrl),
              category: item.category || rawItem.group || rawItem.Group || 'Unknown',
              archivedAtUtc: item.archivedAtUtc || rawItem.ArchivedAtUtc
            };
          });
        this.archivedGarments.set(archived);
        this.isLoadingGarments.set(false);
      },
      error: () => {
        this.isLoadingGarments.set(false);
        this.snackBar.open('Failed to load archived garments', 'Dismiss', { duration: 3000 });
      }
    });
  }

  private loadArchivedOutfits(): void {
    this.isLoadingOutfits.set(true);
    this.apiService.listOutfitRequests(true).pipe(take(1)).subscribe({
      next: (items) => {
        const archived = items
          .filter(item => item.archivedAtUtc)
          .map(item => {
            let imageUrl = '';
            if (item.outfitImages && item.outfitImages.length > 0) {
              imageUrl = this.resolveAssetUrl(item.outfitImages[0].assetUrl);
            }
            return {
              id: item.id,
              imageUrl,
              createdAt: item.createdAtUtc || '',
              archivedAtUtc: item.archivedAtUtc!
            };
          });
        this.archivedOutfits.set(archived);
        this.isLoadingOutfits.set(false);
      },
      error: () => {
        this.isLoadingOutfits.set(false);
        this.snackBar.open('Failed to load archived outfits', 'Dismiss', { duration: 3000 });
      }
    });
  }

  unarchiveModelImage(item: ArchivedModelImage): void {
    this.isUnarchiving.set(true);
    this.apiService.unarchiveModelImage(item.modelImageId).pipe(take(1)).subscribe({
      next: () => {
        this.archivedModelImages.update(items => items.filter(i => i.modelImageId !== item.modelImageId));
        this.snackBar.open('Model image restored', 'Dismiss', { duration: 3000 });
        this.isUnarchiving.set(false);
        this.outfitService.forceReloadUserModelImages().pipe(take(1)).subscribe();
      },
      error: () => {
        this.isUnarchiving.set(false);
        this.snackBar.open('Failed to restore model image', 'Dismiss', { duration: 3000 });
      }
    });
  }

  unarchiveGarment(item: ArchivedGarment): void {
    this.isUnarchiving.set(true);
    this.apiService.unarchiveGarment(item.id).pipe(take(1)).subscribe({
      next: () => {
        this.archivedGarments.update(items => items.filter(i => i.id !== item.id));
        this.snackBar.open('Garment restored', 'Dismiss', { duration: 3000 });
        this.isUnarchiving.set(false);
        this.outfitService.forceReloadGarments().pipe(take(1)).subscribe();
      },
      error: () => {
        this.isUnarchiving.set(false);
        this.snackBar.open('Failed to restore garment', 'Dismiss', { duration: 3000 });
      }
    });
  }

  unarchiveOutfit(item: ArchivedOutfit): void {
    this.isUnarchiving.set(true);
    this.apiService.unarchiveOutfit(item.id).pipe(take(1)).subscribe({
      next: () => {
        this.archivedOutfits.update(items => items.filter(i => i.id !== item.id));
        this.snackBar.open('Outfit restored', 'Dismiss', { duration: 3000 });
        this.isUnarchiving.set(false);
        this.outfitService.refreshGeneratedImages().pipe(take(1)).subscribe();
      },
      error: () => {
        this.isUnarchiving.set(false);
        this.snackBar.open('Failed to restore outfit', 'Dismiss', { duration: 3000 });
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private resolveAssetUrl(url: string | null | undefined): string {
    if (!url) {
      return '';
    }
    if (url.startsWith('/')) {
      const baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
      return `${baseUrl}${url}`;
    }
    return url;
  }
}
