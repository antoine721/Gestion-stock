import { Creneau, Invite, Morceau, Programme, ReponseFormulaire, TypeCreneau } from './models';

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
  morceaux: number;
}

export function resumerProgramme(programme: Programme, jours: number): ResumeProgramme {
  const duree = Math.max(1, jours);
  let joursVides = 0;
  for (let jour = 1; jour <= duree; jour += 1) {
    if (!programme.creneaux.some((x) => x.jour === jour)) joursVides += 1;
  }
  return { creneaux: programme.creneaux.length, joursVides, morceaux: programme.tracklist.length };
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
