import { Injectable, computed, signal } from '@angular/core';

const CLE = 'apero-planner/session';

export interface Session {
  /** Le mot de passe unique de l'app, celui du .env. */
  motDePasse: string;
  prenom: string;
}

/**
 * Ce que ce navigateur sait : le mot de passe commun et mon prenom. Pas de
 * comptes, pas de sessions serveur — on n'est que quelques-uns.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly session = signal<Session | undefined>(lire());
  readonly connecte = computed(() => !!this.session());

  ouvrir(session: Session): void {
    this.session.set(session);
    try {
      localStorage.setItem(CLE, JSON.stringify(session));
    } catch {
      // Navigation privee : la session ne survivra pas au rechargement, tant pis.
    }
  }

  fermer(): void {
    this.session.set(undefined);
    try {
      localStorage.removeItem(CLE);
    } catch {
      // Rien a nettoyer si le stockage est indisponible.
    }
  }
}

function lire(): Session | undefined {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return undefined;
    const session = JSON.parse(brut) as Partial<Session>;
    if (!session.motDePasse || !session.prenom) return undefined;
    return session as Session;
  } catch {
    return undefined;
  }
}
