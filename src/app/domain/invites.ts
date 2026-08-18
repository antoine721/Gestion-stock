import {
  CategoriePaiement,
  Effectif,
  Invite,
  Logistique,
  NiveauxParFamille,
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

export function logistiqueVierge(): Logistique {
  return {
    permis: false,
    vehicule: false,
    tente: false,
    sejourComplet: true,
    placesVoiture: 0,
    chercheCovoiturage: false,
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
    joursPresents: [],
    stylesMusicaux: '',
    logistique: logistiqueVierge(),
    surnom: '',
    boissonsAimees: [],
    niveaux: niveauxVierges(),
    autreAlcool: '',
    team: '',
    servicesPreferes: [],
    goodies: [],
    goodiesAutre: '',
  };
}

/** Personne ne boit rien tant qu'il ne l'a pas dit. */
export function niveauxVierges(): NiveauxParFamille {
  return { biere: 'aucun', vin: 'aucun', spiritueux: 'aucun' };
}

/**
 * Complete un invite venu de la base avec les champs apparus depuis sa
 * creation : les evenements anterieurs au suivi de paiement restent lisibles.
 */
/**
 * Les fiches d'avant portaient un simple compte de jours (« 2 jours »), pas
 * les jours eux-memes. Impossible de deviner LESQUELS, mais jeter
 * l'information serait pire que d'en garder une approximation : on retient les
 * N premiers jours, que l'organisateur corrige d'un clic si besoin.
 */
function joursHerites(brut: Partial<Invite> & { id: string }): number[] {
  const compte = (brut as { joursPresence?: unknown }).joursPresence;
  if (typeof compte !== 'number' || !Number.isFinite(compte) || compte <= 0) return [];
  return tousLesJours(Math.min(30, Math.round(compte)));
}

export function normaliserInvite(brut: Partial<Invite> & { id: string }): Invite {
  return {
    ...inviteVierge(brut.id, brut.participantId ?? ''),
    ...brut,
    logistique: { ...logistiqueVierge(), ...brut.logistique },
    boissonsAimees: brut.boissonsAimees ?? [],
    niveaux: { ...niveauxVierges(), ...brut.niveaux },
    servicesPreferes: brut.servicesPreferes ?? [],
    joursPresents: brut.joursPresents ?? joursHerites(brut),
    goodies: brut.goodies ?? [],
    goodiesAutre: brut.goodiesAutre ?? '',
  };
}

/**
 * La personne a declare ne pas boire une goutte. Lui chercher un profil
 * alcool n'a alors aucun sens : son profil reste vide, et ce vide-la est une
 * reponse, pas un oubli.
 */
export function neBoitPas(invite: Pick<Invite, 'team'>): boolean {
  return invite.team === 'chameau';
}

/**
 * Les quatre choses a faire sur une fiche avant qu'elle soit prete. C'est la
 * checklist de l'organisateur : tant qu'une case manque, il reste une
 * decision a prendre sur cette personne.
 */
export const TACHES_INVITE = [
  { id: 'tarif', libelle: 'Attribuer un tarif' },
  { id: 'paiement', libelle: 'Encaisser le paiement' },
  { id: 'profil', libelle: 'Definir un profil alcool' },
  { id: 'presence', libelle: 'Preciser les jours sur place' },
] as const;

export type TacheInvite = (typeof TACHES_INVITE)[number]['id'];

export interface EtatTachesInvite {
  tarif: boolean;
  paiement: boolean;
  profil: boolean;
  presence: boolean;
  /** Combien de cases sur quatre sont faites. */
  faites: number;
}

/**
 * Ou en est une fiche, tache par tache. Deux raccourcis assumes : un tarif
 * gratuit n'attend aucun paiement, et un non-buveur n'attend aucun profil
 * alcool — sinon ces fiches resteraient eternellement incompletes.
 */
export function etatTaches(
  invite: Invite,
  categories: readonly CategoriePaiement[],
): EtatTachesInvite {
  const categorie = categories.find((x) => x.id === invite.categoriePaiementId);
  const tarif = categorie !== undefined;
  const paiement = invite.paye || (tarif && categorie.montant === 0);
  const profil = invite.personneTypeId !== '' || neBoitPas(invite);
  // « Tous les jours » se stocke comme la liste complete : une liste vide
  // signifie qu'on n'a pas encore pose la question.
  const presence = invite.joursPresents.length > 0;
  const faites = [tarif, paiement, profil, presence].filter(Boolean).length;
  return { tarif, paiement, profil, presence, faites };
}

/** Tous les jours de l'evenement, dans l'ordre : la presence par defaut. */
export function tousLesJours(jours: number): number[] {
  return Array.from({ length: Math.max(1, jours) }, (_, i) => i + 1);
}

/** La personne est la du premier au dernier jour, sans trou. */
export function presenceComplete(invite: Invite, jours: number): boolean {
  const presents = new Set(invite.joursPresents);
  return tousLesJours(jours).every((jour) => presents.has(jour));
}

export interface ResumeLogistique {
  /** Places de covoiturage offertes, toutes voitures confondues. */
  placesOffertes: number;
  /** Invites qui cherchent une place. */
  chercheurs: number;
  /**
   * Invites qui amenent leur tente. Tout le monde dort sur place : la seule
   * question qui reste est de savoir combien de toiles arrivent d'elles-memes,
   * et donc combien de places il faut trouver aux autres.
   */
  tentes: number;
  /** Invites qui apportent du materiel. */
  preteurs: number;
}

/** La synthese covoiturage / couchage, pour la piloter d'un coup d'oeil. */
export function resumerLogistique(invites: readonly Invite[]): ResumeLogistique {
  let placesOffertes = 0;
  let chercheurs = 0;
  let tentes = 0;
  let preteurs = 0;
  for (const invite of invites) {
    placesOffertes += Math.max(0, invite.logistique.placesVoiture);
    if (invite.logistique.chercheCovoiturage) chercheurs += 1;
    if (invite.logistique.tente) tentes += 1;
    if (invite.logistique.materielApporte.trim().length > 0) preteurs += 1;
  }
  return { placesOffertes, chercheurs, tentes, preteurs };
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
