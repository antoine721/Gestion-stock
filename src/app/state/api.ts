import { Injectable, inject } from '@angular/core';
import {
  GoutBoisson,
  Logistique,
  NiveauxParFamille,
  Partage,
  Participant,
  Regime,
  TeamBuveur,
} from '../domain/models';
import { SessionStore } from './session';

/** Ce que la page publique du formulaire a besoin de savoir : rien de plus. */
export interface InfosPubliques {
  nom: string;
  jours: number;
  lieu?: string;
  debut?: string;
  fin?: string;
  description?: string;
  /** Les co-organisateurs, pour que l'invite designe celui qui l'invite. */
  organisateurs?: { id: string; nom: string }[];
}

export interface ReponsePublique {
  prenom: string;
  nom: string;
  invitParId: string;
  invitePar: string;
  regime: Regime;
  allergies: string;
  commentaire: string;
  stylesMusicaux: string;
  logistique: Logistique;
  surnom: string;
  boissonsAimees: GoutBoisson[];
  niveaux: NiveauxParFamille;
  autreAlcool: string;
  team: TeamBuveur | '';
  servicesPreferes: string[];
  goodies: string[];
  goodiesAutre: string;
}

export interface EvenementDistant {
  code: string;
  partage: Partage;
  participants: Participant[];
}

export interface EvenementResume {
  code: string;
  nom: string;
  creeLe: string;
  organisateurs: number;
}

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Client HTTP. Le mot de passe commun voyage dans un en-tete a chaque appel :
 * il n'y a pas de session serveur.
 */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly sessionStore = inject(SessionStore);

  /** Verifie le mot de passe en tentant l'appel le moins couteux. */
  async verifier(motDePasse: string): Promise<void> {
    await this.appeler<{ evenements: EvenementResume[] }>('/api/events', { motDePasse });
  }

  async listerEvenements() {
    const { evenements } = await this.appeler<{ evenements: EvenementResume[] }>('/api/events');
    return evenements;
  }

  async creerEvenement(partage: Partage) {
    return this.appeler<{ code: string }>('/api/events', { methode: 'POST', corps: { partage } });
  }

  async supprimerEvenement(code: string) {
    return this.appeler<{ ok: true }>(`/api/events/${encodeURIComponent(code)}`, {
      methode: 'DELETE',
    });
  }

  async charger(code: string) {
    return this.appeler<EvenementDistant>(`/api/events/${encodeURIComponent(code)}`);
  }

  async enregistrerPartage(code: string, partage: Partage) {
    return this.appeler<{ ok: true }>(`/api/events/${encodeURIComponent(code)}/partage`, {
      methode: 'PUT',
      corps: { partage },
    });
  }

  async rejoindre(code: string, nom: string) {
    return this.appeler<{ id: string; nom: string; deja: boolean }>(
      `/api/events/${encodeURIComponent(code)}/participants`,
      { methode: 'POST', corps: { nom } },
    );
  }

  async enregistrerParticipant(code: string, participant: Participant) {
    return this.appeler<{ ok: true }>(
      `/api/events/${encodeURIComponent(code)}/participants/${encodeURIComponent(participant.id)}`,
      { methode: 'PUT', corps: participant },
    );
  }

  /** Les deux appels publics du formulaire : aucun mot de passe requis. */
  async chargerInfosPubliques(code: string) {
    return this.appeler<InfosPubliques>(`/api/events/${encodeURIComponent(code)}/formulaire`, {
      motDePasse: '',
    });
  }

  async envoyerReponsePublique(code: string, reponse: ReponsePublique) {
    return this.appeler<{ ok: true }>(`/api/events/${encodeURIComponent(code)}/formulaire`, {
      methode: 'POST',
      motDePasse: '',
      corps: reponse,
    });
  }

  async retirerParticipant(code: string, participantId: string) {
    return this.appeler<{ ok: true }>(
      `/api/events/${encodeURIComponent(code)}/participants/${encodeURIComponent(participantId)}`,
      { methode: 'DELETE' },
    );
  }

  private async appeler<T>(
    url: string,
    options: { methode?: string; motDePasse?: string; corps?: unknown } = {},
  ): Promise<T> {
    const motDePasse = options.motDePasse ?? this.sessionStore.session()?.motDePasse ?? '';
    const enTetes: Record<string, string> = { 'x-mot-de-passe': motDePasse };
    if (options.corps !== undefined) enTetes['Content-Type'] = 'application/json';

    const reponse = await fetch(url, {
      method: options.methode ?? 'GET',
      headers: enTetes,
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    });

    if (!reponse.ok) {
      const message = await reponse
        .json()
        .then((x: { erreur?: string }) => x.erreur)
        .catch(() => undefined);
      throw new ErreurApi(reponse.status, message ?? `Erreur ${reponse.status}`);
    }

    return (await reponse.json()) as T;
  }
}
