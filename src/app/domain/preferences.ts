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
  /** L'invitation a bouger les curseurs : « quelles bieres tu aimes ? ». */
  gouts: string;
  /** La question de rythme, formulee avec le mot de la famille. */
  question: string;
  /**
   * L'unite de comptage, en clair. « Combien de verres » ne veut rien dire
   * tant qu'on n'a pas dit de quel verre on parle : c'est la que les
   * reponses partent dans tous les sens.
   */
  repere: string;
}

export const FAMILLES_ALCOOL: readonly OptionFamille[] = [
  {
    id: 'biere',
    libelle: 'Les bieres',
    emoji: '🍺',
    gouts: 'Quelles bieres tu aimes ?',
    question: 'En general, tu bois combien de bieres dans une soiree ?',
    repere: 'On compte en pintes : une pinte = 50 cl, un demi = 25 cl.',
  },
  {
    id: 'vin',
    libelle: 'Les vins & bulles',
    emoji: '🍷',
    gouts: 'Quels vins et bulles tu aimes ?',
    question: 'En general, tu bois combien de verres de vin dans une soiree ?',
    repere: 'On compte en verres de 12 cl : cinq verres dans une bouteille.',
  },
  {
    id: 'spiritueux',
    libelle: 'Les spiritueux',
    emoji: '🥃',
    gouts: 'Quels spiritueux tu aimes ?',
    question: 'En general, tu bois combien de verres de spiritueux dans une soiree ?',
    repere: 'On compte en doses de 4 cl : le verre servi au bar.',
  },
];

export interface OptionBoissonAimee {
  id: string;
  libelle: string;
  famille: FamilleAlcool;
}

export const BOISSONS_AIMEES: readonly OptionBoissonAimee[] = [
  { id: 'biere-blonde', libelle: 'Biere blonde', famille: 'biere' },
  { id: 'biere-blanche', libelle: 'Biere blanche', famille: 'biere' },
  { id: 'biere-rouge', libelle: 'Biere rouge', famille: 'biere' },
  { id: 'biere', libelle: 'Biere, sans preference', famille: 'biere' },
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
    reperes: { biere: '0 pinte', vin: '0 verre', spiritueux: '0 verre' },
  },
  {
    id: 'peu',
    libelle: 'Peu',
    reperes: { biere: '1 a 2 pintes', vin: '1 a 2 verres', spiritueux: '1 verre' },
  },
  {
    id: 'moyen',
    libelle: 'Moyen',
    reperes: { biere: '3 a 5 pintes', vin: '3 a 5 verres', spiritueux: '2 a 3 verres' },
  },
  {
    id: 'beaucoup',
    libelle: 'Beaucoup',
    reperes: { biere: '6 a 9 pintes', vin: '6 a 9 verres', spiritueux: '4 a 6 verres' },
  },
  {
    id: 'abuse',
    libelle: 'Abuse',
    reperes: {
      biere: '10 pintes et plus',
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
 * Le curseur de gout, en pourcentage.
 *
 * Il ne dit pas « combien tu bois » — ca, c'est la question de rythme juste
 * en dessous. Il dit quelle PART de cette famille va a cette boisson-la :
 * quelqu'un qui met 80 % sur la blonde et 20 % sur la blanche boit autant
 * qu'avant, on sait juste quoi acheter. Un curseur a cinq crans donnait
 * l'impression d'un interrupteur ; en pourcentage, la nuance se voit.
 *
 * Zero est le defaut : tous les curseurs sont affiches d'emblee, et ne rien
 * toucher revient a dire « je n'en bois pas ».
 */
export const INTENSITE_MAX = 100;

/** Le curseur avance par crans de 5 % : assez fin pour nuancer, assez gros
 *  pour ne pas jouer au millimetre. */
export const PAS_INTENSITE = 5;

const PALIERS_INTENSITE: readonly { seuil: number; libelle: string }[] = [
  { seuil: 75, libelle: 'Je bois que ca' },
  { seuil: 50, libelle: 'Je suis fan' },
  { seuil: 25, libelle: "J'aime bien" },
  { seuil: 1, libelle: 'De temps en temps' },
  { seuil: 0, libelle: "J'en bois pas" },
];

/** Le mot qui va avec le pourcentage : « 60 % · Je suis fan ». */
export function libelleIntensite(valeur: number): string {
  const propre = Math.min(INTENSITE_MAX, Math.max(0, Math.round(valeur)));
  return PALIERS_INTENSITE.find((x) => propre >= x.seuil)?.libelle ?? '';
}

/**
 * Les fiches d'avant notaient le gout de 0 a 4. Les valeurs 1 a 4 ne peuvent
 * pas etre des pourcentages saisis aujourd'hui — le curseur avance de 5 en 5
 * — donc on les reconnait a coup sur et on les remonte a l'echelle actuelle.
 */
export function normaliserGouts(gouts: readonly GoutBoisson[] | undefined): GoutBoisson[] {
  return (gouts ?? []).map((x) => ({
    boissonId: x.boissonId,
    intensite: x.intensite > 0 && x.intensite <= 4 ? x.intensite * 25 : x.intensite,
  }));
}

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

// ---------------------------------------------------------------------------
// Goodies : ce qu'on fait floquer aux couleurs du festival
// ---------------------------------------------------------------------------

/**
 * Le catalogue des goodies proposes au formulaire. On peut a peu pres tout
 * faire floquer : la liste est large exprès, parce qu'une case a cocher coute
 * moins cher qu'une commande ratee. Elle sert a mesurer l'envie AVANT de
 * commander, pas a promettre quoi que ce soit — et « Autre » recueille les
 * idees qu'on n'avait pas vues venir.
 */
export interface OptionGoodie {
  id: string;
  emoji: string;
  libelle: string;
  /** Le rayon : de quoi grouper la liste sans la trier a la main. */
  famille: 'vetement' | 'accessoire' | 'boisson' | 'souvenir';
}

export const GOODIES: readonly OptionGoodie[] = [
  { id: 't-shirt', emoji: '👕', libelle: 'T-shirt', famille: 'vetement' },
  { id: 'debardeur', emoji: '🎽', libelle: 'Debardeur', famille: 'vetement' },
  { id: 'sweat', emoji: '🧥', libelle: 'Sweat a capuche', famille: 'vetement' },
  { id: 'casquette', emoji: '🧢', libelle: 'Casquette', famille: 'vetement' },
  { id: 'bob', emoji: '🎩', libelle: 'Bob', famille: 'vetement' },
  { id: 'chaussettes', emoji: '🧦', libelle: 'Chaussettes', famille: 'vetement' },
  { id: 'bandana', emoji: '🧣', libelle: 'Bandana', famille: 'vetement' },
  { id: 'poncho', emoji: '☂️', libelle: 'Poncho de pluie', famille: 'vetement' },
  { id: 'lunettes', emoji: '🕶️', libelle: 'Lunettes de soleil', famille: 'accessoire' },
  { id: 'briquet', emoji: '🔥', libelle: 'Briquet', famille: 'accessoire' },
  { id: 'porte-cles', emoji: '🔑', libelle: 'Porte-cles', famille: 'accessoire' },
  { id: 'bracelet', emoji: '🎗️', libelle: 'Bracelet tissu', famille: 'accessoire' },
  { id: 'bracelet-led', emoji: '💡', libelle: 'Bracelet lumineux', famille: 'accessoire' },
  { id: 'eventail', emoji: '🪭', libelle: 'Eventail', famille: 'accessoire' },
  { id: 'tote-bag', emoji: '🛍️', libelle: 'Tote bag', famille: 'accessoire' },
  { id: 'badge', emoji: '📛', libelle: "Badge / pin's", famille: 'accessoire' },
  { id: 'ecocup', emoji: '🥤', libelle: 'Gobelet reutilisable', famille: 'boisson' },
  { id: 'gourde', emoji: '🍶', libelle: 'Gourde', famille: 'boisson' },
  { id: 'decapsuleur', emoji: '🍺', libelle: 'Decapsuleur', famille: 'boisson' },
  { id: 'verre', emoji: '🥃', libelle: 'Verre grave', famille: 'boisson' },
  { id: 'stickers', emoji: '🏷️', libelle: 'Stickers', famille: 'souvenir' },
  { id: 'affiche', emoji: '🖼️', libelle: 'Affiche', famille: 'souvenir' },
  { id: 'photo', emoji: '📸', libelle: 'Photo souvenir', famille: 'souvenir' },
  { id: 'drapeau', emoji: '🏴', libelle: 'Drapeau', famille: 'souvenir' },
];

export const LIBELLE_GOODIE = new Map(GOODIES.map((x) => [x.id, `${x.emoji} ${x.libelle}`]));

/** « 👕 T-shirt · 🏷️ Stickers » — les goodies choisis, en clair. */
export function libelleGoodies(ids: readonly string[]): string {
  return ids
    .map((id) => LIBELLE_GOODIE.get(id))
    .filter((x): x is string => !!x)
    .join(' · ');
}

export interface DemandeGoodie {
  id: string;
  libelle: string;
  nombre: number;
}

/**
 * Combien de personnes veulent chaque goodie, du plus demande au moins
 * demande. C'est ce classement qui dit quoi commander : on ne fait floquer
 * que ce qui interesse assez de monde.
 */
export function resumerGoodies(choix: readonly { goodies: string[] }[]): DemandeGoodie[] {
  const total = new Map<string, number>();
  for (const personne of choix) {
    for (const id of new Set(personne.goodies)) {
      total.set(id, (total.get(id) ?? 0) + 1);
    }
  }
  return GOODIES.filter((x) => (total.get(x.id) ?? 0) > 0)
    .map((x) => ({ id: x.id, libelle: `${x.emoji} ${x.libelle}`, nombre: total.get(x.id) ?? 0 }))
    .sort((a, b) => b.nombre - a.nombre || a.libelle.localeCompare(b.libelle));
}

/** « Biere blonde (75 %) · Rhum (25 %) » — les gouts, en clair. */
export function libelleBoissonsAimees(gouts: readonly GoutBoisson[]): string {
  return normaliserGouts(gouts)
    .filter((x) => x.intensite > 0)
    .map((x) => {
      const nom = LIBELLE_BOISSON_AIMEE.get(x.boissonId);
      if (!nom) return '';
      return `${nom} (${Math.round(x.intensite)} %)`;
    })
    .filter((x) => x.length > 0)
    .join(' · ');
}
