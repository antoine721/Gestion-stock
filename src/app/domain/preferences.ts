import { FamilleAlcool, GoutBoisson, NiveauConso, TeamBuveur } from './models';

/**
 * Ce que les invites DECLARENT aimer et boire, via le formulaire public.
 *
 * Rien ici n'entre dans le calcul : c'est un sondage, pas un bareme. Les
 * quantites achetees restent decidees par les profils de consommation que
 * l'organisateur attache a chaque fiche. Ces listes servent a orienter ce
 * choix — et a savoir quoi mettre au bar.
 */

/**
 * Les trois familles d'alcool, chacune avec sa propre question de rythme. On
 * separe la biere du vin parce qu'on ne les boit pas au meme compteur : cinq
 * bieres et cinq verres de rouge ne racontent pas la meme soiree, et surtout
 * ils ne s'achetent pas pareil.
 */
export interface OptionFamille {
  id: FamilleAlcool;
  libelle: string;
  emoji: string;
  /** La question de rythme, formulee avec le mot de la famille. */
  question: string;
}

export const FAMILLES_ALCOOL: readonly OptionFamille[] = [
  {
    id: 'biere',
    libelle: 'Les bieres',
    emoji: '🍺',
    question: 'Sur une soiree, tu bois combien de bieres ?',
  },
  {
    id: 'vin',
    libelle: 'Les vins & bulles',
    emoji: '🍷',
    question: 'Sur une soiree, tu bois combien de verres de vin ?',
  },
  {
    id: 'spiritueux',
    libelle: 'Les spiritueux',
    emoji: '🥃',
    question: 'Sur une soiree, tu bois combien de verres de spiritueux ?',
  },
];

export interface OptionBoissonAimee {
  id: string;
  libelle: string;
  famille: FamilleAlcool;
}

export const BOISSONS_AIMEES: readonly OptionBoissonAimee[] = [
  { id: 'biere', libelle: 'Biere', famille: 'biere' },
  { id: 'vin-rouge', libelle: 'Vin rouge', famille: 'vin' },
  { id: 'vin-blanc', libelle: 'Vin blanc', famille: 'vin' },
  { id: 'vin-rose', libelle: 'Vin rose', famille: 'vin' },
  { id: 'spritz', libelle: 'Spritz', famille: 'vin' },
  { id: 'rhum', libelle: 'Rhum', famille: 'spiritueux' },
  { id: 'captain', libelle: 'Captain Morgan', famille: 'spiritueux' },
  { id: 'vodka', libelle: 'Vodka', famille: 'spiritueux' },
  { id: 'gin', libelle: 'Gin', famille: 'spiritueux' },
  { id: 'whisky', libelle: 'Whisky', famille: 'spiritueux' },
  { id: 'tequila', libelle: 'Tequila', famille: 'spiritueux' },
  { id: 'pastis', libelle: 'Ricard / Pastis', famille: 'spiritueux' },
  { id: 'get', libelle: 'Get 27 / 31', famille: 'spiritueux' },
  { id: 'jager', libelle: 'Jagermeister', famille: 'spiritueux' },
];

export const LIBELLE_BOISSON_AIMEE = new Map(BOISSONS_AIMEES.map((x) => [x.id, x.libelle]));

export const FAMILLE_PAR_GOUT = new Map(BOISSONS_AIMEES.map((x) => [x.id, x.famille]));

/** Les boissons d'une famille, dans l'ordre de la liste. */
export function boissonsDeFamille(famille: FamilleAlcool): OptionBoissonAimee[] {
  return BOISSONS_AIMEES.filter((x) => x.famille === famille);
}

/**
 * Les paliers de consommation. Les reperes chiffres sont donnes SUR UNE
 * SOIREE, et differents par famille.
 */
export interface PalierConso {
  id: NiveauConso;
  libelle: string;
  reperes: Record<FamilleAlcool, string>;
}

export const PALIERS_CONSO: readonly PalierConso[] = [
  {
    id: 'aucun',
    libelle: 'Rien du tout',
    reperes: { biere: '0 biere', vin: '0 verre', spiritueux: '0 verre' },
  },
  {
    id: 'peu',
    libelle: 'Peu',
    reperes: { biere: '1 a 2 bieres', vin: '1 a 2 verres', spiritueux: '1 verre' },
  },
  {
    id: 'moyen',
    libelle: 'Moyen',
    reperes: { biere: '3 a 5 bieres', vin: '3 a 5 verres', spiritueux: '2 a 3 verres' },
  },
  {
    id: 'beaucoup',
    libelle: 'Beaucoup',
    reperes: { biere: '6 a 9 bieres', vin: '6 a 9 verres', spiritueux: '4 a 6 verres' },
  },
  {
    id: 'abuse',
    libelle: 'Abuse',
    reperes: {
      biere: '10 bieres et plus',
      vin: '10 verres et plus',
      spiritueux: '7 verres et plus',
    },
  },
];

export const LIBELLE_NIVEAU = new Map(PALIERS_CONSO.map((x) => [x.id, x.libelle]));

/**
 * Le milieu de fourchette de chaque palier, en verres SUR UNE SOIREE. C'est
 * ce chiffre qui sert a estimer une consommation a partir d'une declaration —
 * on prend le centre, jamais le haut : mieux vaut reevaluer a la main que
 * gonfler les courses sur un curseur pousse un peu vite.
 */
const VERRES_LONGS: Record<NiveauConso, number> = {
  aucun: 0,
  peu: 1.5,
  moyen: 4,
  beaucoup: 7.5,
  abuse: 11,
};

const VERRES_FORTS: Record<NiveauConso, number> = {
  aucun: 0,
  peu: 1,
  moyen: 2.5,
  beaucoup: 5,
  abuse: 8,
};

export const VERRES_PAR_FAMILLE: Record<FamilleAlcool, Record<NiveauConso, number>> = {
  biere: VERRES_LONGS,
  vin: VERRES_LONGS,
  spiritueux: VERRES_FORTS,
};

/**
 * Le plafond que chaque equipe s'engage a tenir. Il borne l'estimation : une
 * personne qui se dit « Team Degustation » mais coche « abuse » se voit
 * ramenee a son plafond, et l'incoherence est signalee a l'organisateur.
 * Infinity = le bateau ivre n'a pas de plafond declaratif.
 */
export const PLAFOND_TEAM: Record<TeamBuveur, number> = {
  chameau: 0,
  degustation: 3,
  croisiere: 6,
  'bateau-ivre': Number.POSITIVE_INFINITY,
};

/**
 * Les crans du curseur de gout. Zero est le defaut : tous les curseurs sont
 * affiches d'emblee, et ne rien toucher revient a dire « je n'en bois pas ».
 * C'est moins de clics qu'une case a cocher, et ca evite les listes vides.
 */
export const INTENSITES: readonly { valeur: number; libelle: string }[] = [
  { valeur: 0, libelle: "J'en bois pas" },
  { valeur: 1, libelle: 'De temps en temps' },
  { valeur: 2, libelle: "J'aime bien" },
  { valeur: 3, libelle: 'Je suis fan' },
  { valeur: 4, libelle: 'Je bois que ca' },
];

export const INTENSITE_MAX = 4;

export const LIBELLE_INTENSITE = new Map(INTENSITES.map((x) => [x.valeur, x.libelle]));

/** Les quatre equipes de buveurs, du chameau au bateau ivre. */
export interface OptionTeam {
  id: TeamBuveur;
  emoji: string;
  libelle: string;
  description: string;
  /** Ce que l'equipe promet en verres sur une soiree — son plafond, en clair. */
  verres: string;
}

export const TEAMS: readonly OptionTeam[] = [
  {
    id: 'chameau',
    emoji: '🐫',
    libelle: 'Team Chameau',
    description: 'Uniquement du sans alcool, merci !',
    verres: '0 verre',
  },
  {
    id: 'degustation',
    emoji: '🍷',
    libelle: 'Team Degustation',
    description: '1 a 3 verres max par jour, je suis la pour le gout.',
    verres: '1 a 3 verres',
  },
  {
    id: 'croisiere',
    emoji: '⛵',
    libelle: 'Team Vitesse de croisiere',
    description: 'Je bois regulierement mais je sais me tenir.',
    verres: '4 a 6 verres',
  },
  {
    id: 'bateau-ivre',
    emoji: '🏴‍☠️',
    libelle: 'Team Bateau Ivre',
    description: 'Ne comptez pas sur moi pour faire le capitaine de soiree.',
    verres: '7 verres et plus',
  },
];

export const LIBELLE_TEAM = new Map(TEAMS.map((x) => [x.id, `${x.emoji} ${x.libelle}`]));

/**
 * Le festival est participatif : chacun dit ce qu'il prefere faire. Ces
 * envies alimentent l'assignation des missions dans le planning.
 */
export interface OptionService {
  id: string;
  emoji: string;
  libelle: string;
}

export const SERVICES: readonly OptionService[] = [
  { id: 'cuisine', emoji: '🍳', libelle: 'Faire a manger' },
  { id: 'bar', emoji: '🍹', libelle: 'Tenir le bar' },
  { id: 'capitaine', emoji: '🚗', libelle: 'Ne pas boire une soiree (capitaine)' },
  { id: 'table', emoji: '🍽️', libelle: 'Mettre et debarrasser la table' },
  { id: 'vaisselle', emoji: '🧼', libelle: 'Faire la vaisselle' },
  { id: 'dechets', emoji: '🗑️', libelle: 'Ramasser les dechets' },
  { id: 'montage', emoji: '🔧', libelle: 'Montage et demontage' },
  { id: 'courses', emoji: '🛒', libelle: 'Faire les courses' },
  { id: 'accueil', emoji: '🙌', libelle: 'Accueil et parking' },
  { id: 'dj', emoji: '🎧', libelle: 'Mixer / musique' },
  { id: 'photo', emoji: '📷', libelle: 'Photos et souvenirs' },
  { id: 'feu', emoji: '🔥', libelle: "S'occuper du feu / barbecue" },
];

export const LIBELLE_SERVICE = new Map(SERVICES.map((x) => [x.id, `${x.emoji} ${x.libelle}`]));

/** « 🍳 Faire a manger · 🍹 Tenir le bar » — les services choisis, en clair. */
export function libelleServices(ids: readonly string[]): string {
  return ids
    .map((id) => LIBELLE_SERVICE.get(id))
    .filter((x): x is string => !!x)
    .join(' · ');
}

/** « Biere (je bois que ca) · Rhum (j'aime bien) » — les gouts, en clair. */
export function libelleBoissonsAimees(gouts: readonly GoutBoisson[]): string {
  return gouts
    .filter((x) => x.intensite > 0)
    .map((x) => {
      const nom = LIBELLE_BOISSON_AIMEE.get(x.boissonId);
      const intensite = LIBELLE_INTENSITE.get(x.intensite);
      if (!nom) return '';
      return intensite ? `${nom} (${intensite.toLowerCase()})` : nom;
    })
    .filter((x) => x.length > 0)
    .join(' · ');
}
