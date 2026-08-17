import { GoutBoisson, NiveauConso, TeamBuveur } from './models';

/**
 * Ce que les invites DECLARENT aimer et boire, via le formulaire public.
 *
 * Rien ici n'entre dans le calcul : c'est un sondage, pas un bareme. Les
 * quantites achetees restent decidees par les profils de consommation que
 * l'organisateur attache a chaque fiche. Ces listes servent a orienter ce
 * choix — et a savoir quoi mettre au bar.
 */

export interface OptionBoissonAimee {
  id: string;
  libelle: string;
  /** 'basique' = biere, cidre, vin ; 'spiritueux' = les bouteilles fortes. */
  famille: 'basique' | 'spiritueux';
}

export const BOISSONS_AIMEES: readonly OptionBoissonAimee[] = [
  { id: 'biere', libelle: 'Biere', famille: 'basique' },
  { id: 'cidre', libelle: 'Cidre', famille: 'basique' },
  { id: 'vin-rouge', libelle: 'Vin rouge', famille: 'basique' },
  { id: 'vin-blanc', libelle: 'Vin blanc', famille: 'basique' },
  { id: 'vin-rose', libelle: 'Vin rose', famille: 'basique' },
  { id: 'rhum', libelle: 'Rhum', famille: 'spiritueux' },
  { id: 'vodka', libelle: 'Vodka', famille: 'spiritueux' },
  { id: 'gin', libelle: 'Gin', famille: 'spiritueux' },
  { id: 'whisky', libelle: 'Whisky', famille: 'spiritueux' },
  { id: 'tequila', libelle: 'Tequila', famille: 'spiritueux' },
  { id: 'pastis', libelle: 'Ricard / Pastis', famille: 'spiritueux' },
  { id: 'get', libelle: 'Get 27 / 31', famille: 'spiritueux' },
  { id: 'jager', libelle: 'Jagermeister', famille: 'spiritueux' },
];

export const LIBELLE_BOISSON_AIMEE = new Map(BOISSONS_AIMEES.map((x) => [x.id, x.libelle]));

/**
 * Les paliers de consommation. Les reperes chiffres sont donnes SUR UNE
 * SOIREE, et differents par famille : cinq bieres et cinq shots ne racontent
 * pas la meme soiree.
 */
export interface PalierConso {
  id: NiveauConso;
  libelle: string;
  /** Repere chiffre pour les basiques (biere, cidre, vin), en verres. */
  reperesBasiques: string;
  /** Repere chiffre pour les spiritueux, en verres ou shots. */
  reperesSpiritueux: string;
}

export const PALIERS_CONSO: readonly PalierConso[] = [
  {
    id: 'aucun',
    libelle: 'Rien du tout',
    reperesBasiques: '0 verre',
    reperesSpiritueux: '0 verre',
  },
  {
    id: 'peu',
    libelle: 'Peu',
    reperesBasiques: '1 a 2 verres',
    reperesSpiritueux: '1 verre',
  },
  {
    id: 'moyen',
    libelle: 'Moyen',
    reperesBasiques: '3 a 5 verres',
    reperesSpiritueux: '2 a 3 verres',
  },
  {
    id: 'beaucoup',
    libelle: 'Beaucoup',
    reperesBasiques: '6 a 9 verres',
    reperesSpiritueux: '4 a 6 verres',
  },
  {
    id: 'abuse',
    libelle: 'Abuse',
    reperesBasiques: '10 verres et plus',
    reperesSpiritueux: '7 verres et plus',
  },
];

export const LIBELLE_NIVEAU = new Map(PALIERS_CONSO.map((x) => [x.id, x.libelle]));

/**
 * Le milieu de fourchette de chaque palier, en verres SUR UNE SOIREE. C'est
 * ce chiffre qui sert a estimer une consommation a partir d'une declaration —
 * on prend le centre, jamais le haut : mieux vaut reevaluer a la main que
 * gonfler les courses sur une case cochee un peu vite.
 */
export const VERRES_BASIQUES: Record<NiveauConso, number> = {
  aucun: 0,
  peu: 1.5,
  moyen: 4,
  beaucoup: 7.5,
  abuse: 11,
};

export const VERRES_SPIRITUEUX: Record<NiveauConso, number> = {
  aucun: 0,
  peu: 1,
  moyen: 2.5,
  beaucoup: 5,
  abuse: 8,
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

/** Les cinq crans du curseur de gout, du « a l'occasion » au « c'est ma boisson ». */
export const INTENSITES: readonly { valeur: number; libelle: string }[] = [
  { valeur: 1, libelle: "A l'occasion" },
  { valeur: 2, libelle: 'De temps en temps' },
  { valeur: 3, libelle: "J'aime bien" },
  { valeur: 4, libelle: "J'adore" },
  { valeur: 5, libelle: "C'est MA boisson" },
];

export const LIBELLE_INTENSITE = new Map(INTENSITES.map((x) => [x.valeur, x.libelle]));

/** Les quatre equipes de buveurs, du chameau au bateau ivre. */
export interface OptionTeam {
  id: TeamBuveur;
  emoji: string;
  libelle: string;
  description: string;
}

export const TEAMS: readonly OptionTeam[] = [
  {
    id: 'chameau',
    emoji: '🐫',
    libelle: 'Team Chameau',
    description: 'Uniquement du sans alcool, merci !',
  },
  {
    id: 'degustation',
    emoji: '🍷',
    libelle: 'Team Degustation',
    description: '1 a 3 verres max par jour, je suis la pour le gout.',
  },
  {
    id: 'croisiere',
    emoji: '⛵',
    libelle: 'Team Vitesse de croisiere',
    description: 'Je bois regulierement mais je sais me tenir.',
  },
  {
    id: 'bateau-ivre',
    emoji: '🏴‍☠️',
    libelle: 'Team Bateau Ivre',
    description: 'Ne comptez pas sur moi pour faire le capitaine de soiree.',
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

/** « Biere (5) · Rhum (3) » — les boissons aimees et leur intensite. */
export function libelleBoissonsAimees(gouts: readonly GoutBoisson[]): string {
  return gouts
    .map((x) => {
      const nom = LIBELLE_BOISSON_AIMEE.get(x.boissonId);
      return nom ? `${nom} (${x.intensite}/5)` : '';
    })
    .filter((x) => x.length > 0)
    .join(' · ');
}
