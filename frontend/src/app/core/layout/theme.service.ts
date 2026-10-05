import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'kb.theme';

function initialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    return 'light';
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(initialMode());

  constructor() {
    effect(() => {
      const mode = this.mode();
      const root = this.document.documentElement;
      root.classList.toggle('kb-dark', mode === 'dark');
      root.classList.toggle('kb-light', mode === 'light');
      root.style.colorScheme = mode;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        return;
      }
    });
  }

  toggle(): void {
    this.mode.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }
}
