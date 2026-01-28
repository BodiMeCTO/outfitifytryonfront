import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Service to handle file downloads that work properly on both desktop and mobile.
 * On mobile, uses Web Share API to allow saving to camera roll/gallery.
 * On desktop, uses traditional anchor download.
 */
@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private readonly snackBar = inject(MatSnackBar);

  /**
   * Detect if running on a mobile device
   */
  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Check if Web Share API with file support is available
   */
  private canShareFiles(): boolean {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
  }

  /**
   * Download an image - uses share on mobile for gallery save, anchor on desktop
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

      // On mobile, try to use share API which allows saving to gallery
      if (this.isMobile() && this.canShareFiles()) {
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

      // Desktop or fallback: use anchor download
      this.downloadBlob(blob, filename);

    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab and let user save manually
      this.fallbackDownload(imageUrl, filename);
    }
  }

  /**
   * Download a video - uses share on mobile for gallery save, anchor on desktop
   */
  async downloadVideo(videoUrl: string, filename: string): Promise<void> {
    try {
      // On mobile, try to use share API which allows saving to gallery
      if (this.isMobile() && this.canShareFiles()) {
        // Fetch the video as a blob
        const response = await fetch(videoUrl, {
          mode: 'cors',
          credentials: 'omit'
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
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

        // Fallback: use anchor download with the blob we already have
        this.downloadBlob(blob, filename);
        return;
      }

      // Desktop: use anchor download directly (don't fetch, just link)
      this.anchorDownload(videoUrl, filename);

    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: direct link
      this.anchorDownload(videoUrl, filename);
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

    // Cleanup after a short delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);
  }

  /**
   * Download using an anchor element with a URL
   */
  private anchorDownload(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Fallback: open URL and show help message
   */
  private fallbackDownload(url: string, filename: string): void {
    this.anchorDownload(url, filename);

    if (this.isMobile()) {
      this.snackBar.open('Long-press the image to save to your gallery.', 'Got it', {
        duration: 5000
      });
    } else {
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
    watermarkText: string = 'AI-Generated Content'
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

      // On mobile, try share API
      if (this.isMobile() && this.canShareFiles()) {
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
