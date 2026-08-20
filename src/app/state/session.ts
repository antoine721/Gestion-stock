import { Injectable, computed, signal } from '@angular/core';

const CLE = 'apero-planner/session';

export interface Session {
  /** Le prenom qui signe tes invites. Avec Google, il vient du compte. */
  prenom: string;
  /** Le compte Google connecte. La preuve, elle, est dans un cookie signe. */
  email?: string;
  photo?: string;
  /** Repli : le mot de passe commun, envoye dans un en-tete a chaque appel. */
  motDePasse?: string;
}

/**
 * Ce que ce navigateur sait de toi. La partie admin se franchit avec un compte
 * Google ; ce qu'on garde ici n'est qu'une copie lisible de l'identite, la
 * session qui fait foi est le cookie que le serveur a pose.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly session = signal<Session | undefined>(lire());
  readonly connecte = computed(() => !!this.session());

  private restauration?: Promise<boolean>;

  ouvrir(session: Session): void {
    this.session.set(session);
    try {
      localStorage.setItem(CLE, JSON.stringify(session));
    } catch {
      // Navigation privee : la session ne survivra pas au rechargement, tant pis.
    }
  }

  /**
   * Au retour de Google le navigateur revient les mains vides : rien en
   * localStorage, tout dans le cookie. On demande au serveur qui on est —
   * une seule fois, le temps que la reponse arrive.
   */
  async restaurer(): Promise<boolean> {
    if (this.connecte()) return true;
    const demande = (this.restauration ??= this.demanderIdentite());
    const reconnu = await demande;
    // Un echec ne se met pas en cache : le cookie peut arriver plus tard.
    if (!reconnu) this.restauration = undefined;
    return reconnu;
  }

  async fermer(): Promise<void> {
    this.session.set(undefined);
    this.restauration = undefined;
    try {
      localStorage.removeItem(CLE);
    } catch {
      // Rien a nettoyer si le stockage est indisponible.
    }
    try {
      await fetch('/api/auth/deconnexion', { method: 'POST' });
    } catch {
      // Hors ligne : le cookie expirera de lui-meme.
    }
  }

  private async demanderIdentite(): Promise<boolean> {
    try {
      const reponse = await fetch('/api/auth/moi');
      if (!reponse.ok) return false;
      const identite = (await reponse.json()) as Partial<Session>;
      if (!identite.prenom || !identite.email) return false;
      this.ouvrir({ prenom: identite.prenom, email: identite.email, photo: identite.photo });
      return true;
    } catch {
      return false;
    }
  }
}

function lire(): Session | undefined {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return undefined;
    const session = JSON.parse(brut) as Partial<Session>;
    if (!session.prenom) return undefined;
    if (!session.email && !session.motDePasse) return undefined;
    return session as Session;
  } catch {
    return undefined;
  }
}
