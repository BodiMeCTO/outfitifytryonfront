import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type DisclaimerVariant = 'inline' | 'banner' | 'footer' | 'compact';

@Component({
  selector: 'app-ai-disclaimer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './ai-disclaimer.component.html',
  styleUrl: './ai-disclaimer.component.scss'
})
export class AiDisclaimerComponent {
  @Input() variant: DisclaimerVariant = 'inline';
  @Input() showIcon = true;

  readonly shortText = 'AI-generated image - may not accurately represent actual products';

  readonly mediumText = 'Images are AI-generated for visualization purposes only. Results may not accurately represent actual garments, fit, or appearance.';

  readonly fullText = 'This image was generated using artificial intelligence. AI-generated content may contain inaccuracies and should not be considered an exact representation of how garments will look in reality. Actual products may differ in color, fit, texture, and appearance.';

  get displayText(): string {
    switch (this.variant) {
      case 'compact':
        return this.shortText;
      case 'inline':
        return this.shortText;
      case 'banner':
        return this.mediumText;
      case 'footer':
        return this.shortText;
      default:
        return this.shortText;
    }
  }
}
