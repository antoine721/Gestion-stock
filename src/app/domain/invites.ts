import { BOISSON_PAR_ID } from './catalogue';
import {
  CategoriePaiement,
  ConsommationType,
  Effectif,
  Hebergement,
  Invite,
  Logistique,
  Regime,
} from './models';

/**
 * Invites nommes.
 *
 * L'app a deux facons de declarer des invites : les effectifs anonymes
 * (« j'amene trois buveurs de biere ») et les invites nommes (« Paul, buveur
 * de biere »). Les deux s'additionnent : nommer quelqu'un AJOUTE une tete,
 * ca ne remplace pas un effectif deja saisi.
 */

export const REGIMES: readonly { id: Regime; libelle: string }[] = [
  { id: 'omnivore', libelle: 'Omnivore' },
  { id: 'vegetarien', libelle: 'Vegetarien' },
  { id: 'vegan', libelle: 'Vegan' },
  { id: 'sans-gluten', libelle: 'Sans gluten' },
  { id: 'sans-lactose', libelle: 'Sans lactose' },
  { id: 'halal', libelle: 'Halal' },
  { id: 'casher', libelle: 'Casher' },
];

export const LIBELLE_REGIME: Record<Regime, string> = Object.fromEntries(
  REGIMES.map((x) => [x.id, x.libelle]),
) as Record<Regime, string>;

export const HEBERGEMENTS: readonly { id: Hebergement; libelle: string }[] = [
  { id: 'a-definir', libelle: 'A definir' },
  { id: 'sur-place', libelle: 'Dort sur place' },
  { id: 'tente', libelle: 'Amene sa tente' },
  { id: 'rentre', libelle: 'Rentre chez lui' },
];

export const LIBELLE_HEBERGEMENT: Record<Hebergement, string> = Object.fromEntries(
  HEBERGEMENTS.map((x) => [x.id, x.libelle]),
) as Record<Hebergement, string>;

export function logistiqueVierge(): Logistique {
  return {
    permis: false,
    vehicule: false,
    tente: false,
    sejourComplet: true,
    placesVoiture: 0,
    chercheCovoiturage: false,
    hebergement: 'a-definir',
    arrivee: '',
    depart: '',
    materielApporte: '',
    besoins: '',
  };
}

export function inviteVierge(id: string, participantId: string): Invite {
  return {
    id,
    prenom: '',
    nom: '',
    participantId,
    personneTypeId: '',
    regime: 'omnivore',
    allergies: '',
    envies: '',
    remarques: '',
    categoriePaiementId: '',
    paye: false,
    montantPaye: 0,
    joursPresence: 0,
    consommationDeclaree: [],
    stylesMusicaux: '',
    logistique: logistiqueVierge(),
    surnom: '',
    boissonsAimees: [],
    niveauBasiques: 'aucun',
    niveauSpiritueux: 'aucun',
    team: '',
    servicesPreferes: [],
  };
}

/**
 * « Biere × 4 · Spritz × 2 » : la conso declaree en toutes lettres. Les
 * boissons inconnues du catalogue sont ignorees a l'affichage.
 */
export function libelleConsommations(consommations: readonly ConsommationType[]): string {
  return consommations
    .filter((x) => x.verresParJour > 0)
    .map((x) => {
      const boisson = BOISSON_PAR_ID.get(x.boissonId);
      return boisson ? `${boisson.nom} × ${x.verresParJour}` : '';
    })
    .filter((x) => x.length > 0)
    .join(' · ');
}

/**
 * Complete un invite venu de la base avec les champs apparus depuis sa
 * creation : les evenements anterieurs au suivi de paiement restent lisibles.
 */
export function normaliserInvite(brut: Partial<Invite> & { id: string }): Invite {
  return {
    ...inviteVierge(brut.id, brut.participantId ?? ''),
    ...brut,
    logistique: { ...logistiqueVierge(), ...brut.logistique },
    boissonsAimees: brut.boissonsAimees ?? [],
    servicesPreferes: brut.servicesPreferes ?? [],
  };
}

export interface ResumeLogistique {
  /** Places de covoiturage offertes, toutes voitures confondues. */
  placesOffertes: number;
  /** Invites qui cherchent une place. */
  chercheurs: number;
  /** Invites qui dorment sur place (tente comprise). */
  dormeurs: number;
  /** Invites qui apportent du materiel. */
  preteurs: number;
}

/** La synthese covoiturage / couchage, pour la piloter d'un coup d'oeil. */
export function resumerLogistique(invites: readonly Invite[]): ResumeLogistique {
  let placesOffertes = 0;
  let chercheurs = 0;
  let dormeurs = 0;
  let preteurs = 0;
  for (const invite of invites) {
    placesOffertes += Math.max(0, invite.logistique.placesVoiture);
    if (invite.logistique.chercheCovoiturage) chercheurs += 1;
    if (invite.logistique.hebergement === 'sur-place' || invite.logistique.hebergement === 'tente')
      dormeurs += 1;
    if (invite.logistique.materielApporte.trim().length > 0) preteurs += 1;
  }
  return { placesOffertes, chercheurs, dormeurs, preteurs };
}

/** Les invites nommes qu'un co-organisateur amene. */
export function invitesNommesDe(invites: readonly Invite[], participantId: string): Invite[] {
  return invites.filter((x) => x.participantId === participantId);
}

/**
 * Fusionne les effectifs anonymes et les invites nommes d'un participant :
 * chaque invite nomme dont le profil existe encore compte pour une personne
 * de ce profil. C'est cette fusion qui alimente le moteur de calcul, pour
 * que l'invariant « on raisonne en personnes x profils » tienne toujours.
 */
export function fusionnerEffectifs(
  effectifs: readonly Effectif[],
  invitesNommes: readonly Invite[],
): Effectif[] {
  const total = new Map<string, number>();
  for (const effectif of effectifs) {
    if (effectif.nombre > 0) {
      total.set(
        effectif.personneTypeId,
        (total.get(effectif.personneTypeId) ?? 0) + effectif.nombre,
      );
    }
  }
  for (const invite of invitesNommes) {
    if (invite.personneTypeId) {
      total.set(invite.personneTypeId, (total.get(invite.personneTypeId) ?? 0) + 1);
    }
  }
  return [...total.entries()].map(([personneTypeId, nombre]) => ({ personneTypeId, nombre }));
}

/**
 * Un invite nomme SANS profil compte quand meme comme une tete a nourrir :
 * on le represente par un effectif vers un profil vide, que le moteur ignore
 * cote boissons mais que invitesDe() additionne.
 */
export function effectifsAvecInvites(
  effectifs: readonly Effectif[],
  invitesNommes: readonly Invite[],
): Effectif[] {
  const fusion = fusionnerEffectifs(effectifs, invitesNommes);
  const sansProfil = invitesNommes.filter((x) => !x.personneTypeId).length;
  return sansProfil > 0 ? [...fusion, { personneTypeId: '', nombre: sansProfil }] : fusion;
}

export interface CompteRegime {
  regime: Regime;
  libelle: string;
  nombre: number;
}

/** Combien de personnes par regime, pour dimensionner les plats. */
export function compterParRegime(invites: readonly Invite[]): CompteRegime[] {
  const total = new Map<Regime, number>();
  for (const invite of invites) {
    total.set(invite.regime, (total.get(invite.regime) ?? 0) + 1);
  }
  return REGIMES.filter((x) => total.has(x.id)).map((x) => ({
    regime: x.id,
    libelle: x.libelle,
    nombre: total.get(x.id) ?? 0,
  }));
}

/** Les invites qui declarent une allergie : la liste a avoir en cuisine. */
export function invitesAvecAllergies(invites: readonly Invite[]): Invite[] {
  return invites.filter((x) => x.allergies.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Encaissements : le paiement se fait hors de l'app, ici on le suit
// ---------------------------------------------------------------------------

export interface Encaissements {
  /** Somme des tarifs des categories attribuees. */
  attendu: number;
  /** Somme reellement versee par ceux qui ont paye. */
  encaisse: number;
  reste: number;
  payes: number;
  /** Invites avec une categorie payante qui n'ont pas encore paye. */
  enAttente: number;
}

export function calculerEncaissements(
  invites: readonly Invite[],
  categories: readonly CategoriePaiement[],
): Encaissements {
  const parId = new Map(categories.map((x) => [x.id, x]));
  let attendu = 0;
  let encaisse = 0;
  let payes = 0;
  let enAttente = 0;

  for (const invite of invites) {
    const categorie = parId.get(invite.categoriePaiementId);
    if (categorie) attendu += Math.max(0, categorie.montant);
    if (invite.paye) {
      encaisse += Math.max(0, invite.montantPaye);
      payes += 1;
    } else if (categorie && categorie.montant > 0) {
      enAttente += 1;
    }
  }

  return { attendu, encaisse, reste: Math.max(0, attendu - encaisse), payes, enAttente };
}
