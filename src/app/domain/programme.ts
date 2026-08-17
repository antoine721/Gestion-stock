import {
  Creneau,
  DjSet,
  Invite,
  Morceau,
  Participant,
  Programme,
  ReponseFormulaire,
  StatutDjSet,
  TypeCreneau,
} from './models';

/**
 * Programme.
 *
 * Le planning du festival — ce qui a ete mis en place, quand, qui s'en
 * occupe — et la musique : la tracklist commune, alimentee a la main ou
 * depuis les demandes du formulaire.
 */

export const PROGRAMME_PAR_DEFAUT: Programme = { creneaux: [], tracklist: [] };

export const TYPES_CRENEAU: readonly { id: TypeCreneau; libelle: string; emoji: string }[] = [
  { id: 'activite', libelle: 'Activite', emoji: '🎯' },
  { id: 'repas', libelle: 'Repas', emoji: '🍽️' },
  { id: 'musique', libelle: 'Musique', emoji: '🎧' },
  { id: 'logistique', libelle: 'Logistique', emoji: '🧰' },
  { id: 'autre', libelle: 'Autre', emoji: '📌' },
];

export const LIBELLE_TYPE_CRENEAU: Record<TypeCreneau, string> = Object.fromEntries(
  TYPES_CRENEAU.map((x) => [x.id, x.libelle]),
) as Record<TypeCreneau, string>;

export function creneauVierge(id: string, jour: number): Creneau {
  return {
    id,
    jour,
    debut: '',
    fin: '',
    titre: '',
    type: 'activite',
    responsable: '',
    lieu: '',
    notes: '',
    assignes: [],
  };
}

/** Complete un creneau d'avant les missions : les assignes par defaut. */
export function normaliserCreneau(brut: Partial<Creneau> & { id: string }): Creneau {
  return { ...creneauVierge(brut.id, brut.jour ?? 1), ...brut, assignes: brut.assignes ?? [] };
}

// ---------------------------------------------------------------------------
// Missions : qui fait quoi, creneau par creneau
// ---------------------------------------------------------------------------

export interface PersonneAssignable {
  /** 'inv:<id>' pour un invite nomme, 'org:<id>' pour un co-organisateur. */
  ref: string;
  nom: string;
}

/** Tout le monde participe : co-organisateurs d'abord, puis les invites. */
export function personnesAssignables(
  participants: readonly Participant[],
  invites: readonly Invite[],
): PersonneAssignable[] {
  return [
    ...participants.map((x) => ({ ref: `org:${x.id}`, nom: x.nom })),
    ...invites.map((x) => ({
      ref: `inv:${x.id}`,
      nom: `${x.prenom} ${x.nom}`.trim() || 'Invite sans nom',
    })),
  ];
}

/** Le nom derriere une reference d'assignation ; '' si la personne a disparu. */
export function nomDeRef(
  ref: string,
  participants: readonly Participant[],
  invites: readonly Invite[],
): string {
  if (ref.startsWith('org:')) {
    return participants.find((x) => x.id === ref.slice(4))?.nom ?? '';
  }
  if (ref.startsWith('inv:')) {
    const invite = invites.find((x) => x.id === ref.slice(4));
    return invite ? `${invite.prenom} ${invite.nom}`.trim() || 'Invite sans nom' : '';
  }
  return ref;
}

/** Les missions d'une personne, pour verifier qu'elle n'est pas surchargee. */
export function missionsDe(programme: Programme, ref: string): Creneau[] {
  return programme.creneaux.filter((x) => x.assignes.includes(ref));
}

// ---------------------------------------------------------------------------
// DJ : le tableau horaire des sets et son workflow
// ---------------------------------------------------------------------------

export const STATUTS_DJ_SET: readonly { id: StatutDjSet; libelle: string }[] = [
  { id: 'demande', libelle: 'Demande' },
  { id: 'valide', libelle: 'Valide' },
  { id: 'refuse', libelle: 'Refuse' },
  { id: 'joue', libelle: 'Joue' },
];

export const LIBELLE_STATUT_DJ: Record<StatutDjSet, string> = Object.fromEntries(
  STATUTS_DJ_SET.map((x) => [x.id, x.libelle]),
) as Record<StatutDjSet, string>;

export function djSetVierge(id: string, jour: number): DjSet {
  return { id, jour, debut: '', fin: '', dj: '', style: '', statut: 'demande', notes: '' };
}

/** Les sets en ordre chronologique, les sans-heure a la fin de leur jour. */
export function trierDjSets(djSets: readonly DjSet[]): DjSet[] {
  return [...djSets].sort((a, b) => {
    if (a.jour !== b.jour) return a.jour - b.jour;
    if (!a.debut && !b.debut) return 0;
    if (!a.debut) return 1;
    if (!b.debut) return -1;
    return a.debut.localeCompare(b.debut);
  });
}

export interface ResumeDj {
  total: number;
  demandes: number;
  valides: number;
}

export function resumerDj(djSets: readonly DjSet[]): ResumeDj {
  return {
    total: djSets.length,
    demandes: djSets.filter((x) => x.statut === 'demande').length,
    valides: djSets.filter((x) => x.statut === 'valide' || x.statut === 'joue').length,
  };
}

export function morceauVierge(id: string): Morceau {
  return { id, titre: '', artiste: '', demandePar: '' };
}

/**
 * Les creneaux d'un jour, en ordre chronologique. Les heures « 18:30 » se
 * trient en texte ; un creneau sans heure part a la fin, il reste a caler.
 */
export function planningDuJour(programme: Programme, jour: number): Creneau[] {
  return programme.creneaux
    .filter((x) => x.jour === jour)
    .sort((a, b) => {
      if (!a.debut && !b.debut) return 0;
      if (!a.debut) return 1;
      if (!b.debut) return -1;
      return a.debut.localeCompare(b.debut);
    });
}

export interface ResumeProgramme {
  creneaux: number;
  /** Jours de l'evenement sans aucun creneau : le programme a des trous. */
  joursVides: number;
  /** Creneaux sans personne dessus : des missions a pourvoir. */
  sansAssigne: number;
}

export function resumerProgramme(programme: Programme, jours: number): ResumeProgramme {
  const duree = Math.max(1, jours);
  let joursVides = 0;
  for (let jour = 1; jour <= duree; jour += 1) {
    if (!programme.creneaux.some((x) => x.jour === jour)) joursVides += 1;
  }
  return {
    creneaux: programme.creneaux.length,
    joursVides,
    sansAssigne: programme.creneaux.filter((x) => x.assignes.length === 0).length,
  };
}

export interface DemandeMusicale {
  /** Cle stable, pour ne pas reproposer une demande deja ajoutee. */
  cle: string;
  texte: string;
  demandePar: string;
}

/**
 * Les envies musicales collectees ailleurs : les reponses du formulaire et
 * les remarques des fiches invites. On les propose telles quelles, a ajouter
 * d'un clic dans la tracklist.
 */
export function demandesMusicales(
  reponses: readonly ReponseFormulaire[],
  invites: readonly Invite[],
  tracklist: readonly Morceau[],
): DemandeMusicale[] {
  const dejaLa = new Set(tracklist.map((x) => `${x.titre}|${x.demandePar}`.toLowerCase()));
  const demandes: DemandeMusicale[] = [];

  for (const reponse of reponses) {
    const texte = reponse.recommandations.trim();
    if (texte) demandes.push({ cle: `reponse:${reponse.id}`, texte, demandePar: reponse.prenom });
  }
  for (const invite of invites) {
    const texte = invite.remarques.trim();
    // Les fiches importees du formulaire rangent la musique dans remarques :
    // on ne propose que ce qui y ressemble, pas les « arrive samedi ».
    if (texte && /musique|playlist|dj|artiste|chanson|morceau/i.test(texte)) {
      demandes.push({ cle: `invite:${invite.id}`, texte, demandePar: invite.prenom });
    }
  }

  return demandes.filter((x) => !dejaLa.has(`${x.texte}|${x.demandePar}`.toLowerCase()));
}

/** Les invites qui veulent faire quelque chose : DJ, jeux, animation... */
export function volontaires(invites: readonly Invite[]): Invite[] {
  return invites.filter((x) => x.envies.trim().length > 0);
}
