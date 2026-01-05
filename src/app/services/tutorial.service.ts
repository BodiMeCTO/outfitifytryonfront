import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly STORAGE_KEY = 'outfitify_tutorial_completed';

  isTutorialCompleted(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  markTutorialCompleted(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
  }

  resetTutorial(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
