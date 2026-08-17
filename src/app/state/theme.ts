import { Injectable, signal } from '@angular/core';

const CLE = 'combien-acheter.theme';

/**
 * Le theme est un choix, pas une detection : l'app s'ouvre en clair pour tout
 * le monde, quel que soit le reglage du systeme, et le sombre ne s'active que
 * si on le demande. Le choix se garde d'une visite a l'autre.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  readonly sombre = signal(false);

  constructor() {
    this.appliquer(localStorage.getItem(CLE) === 'sombre');
  }

  basculer(): void {
    this.appliquer(!this.sombre());
    localStorage.setItem(CLE, this.sombre() ? 'sombre' : 'clair');
  }

  private appliquer(sombre: boolean): void {
    this.sombre.set(sombre);
    document.documentElement.setAttribute('data-theme', sombre ? 'sombre' : 'clair');
    // La barre systeme du navigateur suit le fond, comme dans une app native.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', sombre ? '#0b0f13' : '#eef1f6');
  }
}
