import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Service to handle file downloads that work properly on both desktop and mobile.
 * On Android, uses Web Share API to allow saving to camera roll/gallery.
 * On iOS, opens blob URL with instructions to save (since download attribute is ignored).
 * On desktop, uses traditional anchor download.
 */
@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private readonly snackBar = inject(MatSnackBar);

  /**
   * Detect if running on iOS (Safari ignores download attribute)
   */
  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /**
   * Detect if running on Android
   */
  private isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  /**
   * Detect if running on a mobile device
   */
  private isMobile(): boolean {
    return this.isIOS() || this.isAndroid() ||
      /webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Check if Web Share API with file support is available
   */
  private canShareFiles(): boolean {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
  }

  /**
   * Download an image - uses share on Android for gallery save, blob URL on iOS, anchor on desktop
   */
  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      // On Android, try to use share API which allows saving to gallery
      if (this.isAndroid() && this.canShareFiles()) {
        const file = new File([blob], filename, { type: blob.type || 'image/png' });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            return; // Success - user chose where to save
          } catch (err) {
            // User cancelled or share failed - fall through to download
            if ((err as DOMException).name === 'AbortError') {
              return; // User cancelled, don't show error
            }
            console.warn('Share failed, falling back to download:', err);
          }
        }
      }

      // On iOS, open blob URL and show instructions (download attribute is ignored)
      if (this.isIOS()) {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        this.snackBar.open('Long-press the image and tap "Add to Photos" to save.', 'Got it', {
          duration: 5000
        });
        // Cleanup after a longer delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }

      // Desktop or fallback: use anchor download
      this.downloadBlob(blob, filename);

    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab and let user save manually
      this.fallbackDownload(imageUrl, filename);
    }
  }

  /**
   * Download a video - uses Web Share API on mobile (both iOS and Android) for gallery save,
   * blob download on desktop. Web Share API shows "Save to Photos" on iOS for videos.
   */
  async downloadVideo(videoUrl: string, filename: string): Promise<void> {
    try {
      // Show loading indicator for mobile since video fetch can take time
      if (this.isMobile()) {
        this.snackBar.open('Preparing video for save...', undefined, { duration: 10000 });
      }

      // Fetch the video as a blob (needed for all platforms for CORS)
      const response = await fetch(videoUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      // On mobile (iOS and Android), try Web Share API which allows saving to Photos/Gallery
      // Web Share API Level 2 supports file sharing and shows "Save to Photos" option
      if (this.isMobile() && this.canShareFiles()) {
        const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            this.snackBar.dismiss();
            return; // Success - user chose where to save
          } catch (err) {
            // User cancelled or share failed - fall through to fallback
            if ((err as DOMException).name === 'AbortError') {
              this.snackBar.dismiss();
              return; // User cancelled, don't show error
            }
            console.warn('Share failed, falling back to alternative method:', err);
          }
        }
      }

      // iOS fallback: try opening blob URL directly (may work better than remote URL)
      // User can then use Share button in Safari's video player to save
      if (this.isIOS()) {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        this.snackBar.open(
          'Tap the Share button (box with arrow) in Safari, then "Save to Files" or "Save Video".',
          'Got it',
          { duration: 8000 }
        );
        // Cleanup after delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
        return;
      }

      // Android fallback: try blob download
      if (this.isAndroid()) {
        this.downloadBlob(blob, filename);
        this.snackBar.open('Video saved to Downloads folder.', 'OK', { duration: 3000 });
        return;
      }

      // Desktop: use blob download
      this.downloadBlob(blob, filename);

    } catch (error) {
      console.error('Download failed:', error);
      this.snackBar.dismiss();

      // Fallback: open original URL and provide instructions
      if (this.isIOS()) {
        window.open(videoUrl, '_blank');
        this.snackBar.open(
          'Tap the Share button in Safari, then "Save to Files" or "Save Video".',
          'Got it',
          { duration: 8000 }
        );
      } else if (this.isAndroid()) {
        // Try direct link download
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.snackBar.open('If download didn\'t start, long-press the video to save.', 'Got it', {
          duration: 4000
        });
      } else {
        // Desktop fallback
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }

  /**
   * Download a blob using an anchor element
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup after a longer delay to ensure download completes
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  }

  /**
   * Download using an anchor element with a URL (no target="_blank" to avoid opening in new tab)
   */
  private anchorDownload(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Fallback: open URL and show help message
   */
  private fallbackDownload(url: string, filename: string): void {
    if (this.isIOS()) {
      // On iOS, open in new tab so user can long-press to save
      window.open(url, '_blank');
      this.snackBar.open('Long-press the image and tap "Add to Photos" to save.', 'Got it', {
        duration: 5000
      });
    } else if (this.isMobile()) {
      this.anchorDownload(url, filename);
      this.snackBar.open('Long-press the image to save to your gallery.', 'Got it', {
        duration: 5000
      });
    } else {
      this.anchorDownload(url, filename);
      this.snackBar.open('If download didn\'t start, right-click to save.', 'Got it', {
        duration: 4000
      });
    }
  }

  /**
   * Download an image with a watermark
   */
  async downloadImageWithWatermark(
    imageUrl: string,
    filename: string,
    watermarkText: string = 'Created with OUTFITIFY.AI'
  ): Promise<void> {
    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      // Create canvas and draw image
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw the original image
      ctx.drawImage(imageBitmap, 0, 0);

      // Add watermark
      const padding = 20;
      const fontSize = Math.max(24, Math.floor(canvas.width / 40)); // Responsive font size

      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textBaseline = 'bottom';

      // Measure text for background
      const textMetrics = ctx.measureText(watermarkText);
      const textWidth = textMetrics.width;
      const textHeight = fontSize * 1.2;

      // Position in bottom-right corner
      const x = canvas.width - textWidth - padding * 2;
      const y = canvas.height - padding;

      // Draw semi-transparent background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x - padding / 2, y - textHeight, textWidth + padding, textHeight + padding / 2);

      // Draw watermark text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(watermarkText, x, y);

      // Convert to blob
      const watermarkedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create watermarked image'));
        }, 'image/png');
      });

      // On Android, try share API
      if (this.isAndroid() && this.canShareFiles()) {
        const file = new File([watermarkedBlob], filename, { type: 'image/png' });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            this.snackBar.open('Image saved with AI watermark.', 'OK', { duration: 2500 });
            return;
          } catch (err) {
            if ((err as DOMException).name === 'AbortError') {
              return; // User cancelled
            }
            console.warn('Share failed, falling back to download:', err);
          }
        }
      }

      // On iOS, open blob URL and show instructions
      if (this.isIOS()) {
        const blobUrl = URL.createObjectURL(watermarkedBlob);
        window.open(blobUrl, '_blank');
        this.snackBar.open('Long-press the image and tap "Add to Photos" to save.', 'Got it', {
          duration: 5000
        });
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }

      // Desktop or fallback
      this.downloadBlob(watermarkedBlob, filename);
      this.snackBar.open('Downloaded with AI watermark.', 'OK', { duration: 2500 });

    } catch (error) {
      console.error('Watermark download failed:', error);
      this.snackBar.open('Failed to add watermark. Try regular download instead.', 'Dismiss', {
        duration: 4000
      });
    }
  }
}
