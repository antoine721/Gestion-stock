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
    libelle: 'Les alcools forts',
    emoji: '🥃',
    gouts: 'Quels alcools forts tu aimes ?',
    question: 'En general, tu bois combien de verres d’alcool fort dans une soiree ?',
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
  { id: 'kir', libelle: 'Kir', famille: 'vin' },
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
      biere: '10 a 14 pintes',
      vin: '10 a 14 verres',
      spiritueux: '7 a 9 verres',
    },
  },
  {
    id: 'sans-limite',
    libelle: 'Sans limite',
    reperes: {
      biere: '15 pintes ou plus',
      vin: '15 verres ou plus',
      spiritueux: '10 verres ou plus',
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
  abuse: 12,
  'sans-limite': 16,
};

const VERRES_FORTS: Record<NiveauConso, number> = {
  aucun: 0,
  peu: 1,
  moyen: 2.5,
  beaucoup: 5,
  abuse: 8,
  'sans-limite': 11,
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
 * Les gouts d'une famille se partagent 100 %.
 *
 * Un curseur ne dit pas « combien je bois » — ca, c'est la question de
 * rythme. Il dit quelle part des verres de la famille va a cette boisson.
 * Les curseurs d'une meme famille sont donc lies : ce qu'on donne a l'un,
 * on le prend aux autres.
 */
export const PAS_GOUT = 5;

/** En dessous d'un cran, une part ne veut plus rien dire : elle tombe a zero. */
function arrondirPart(valeur: number): number {
  const cran = Math.round(valeur / PAS_GOUT) * PAS_GOUT;
  const borne = Math.min(100, Math.max(0, cran));
  return borne < PAS_GOUT ? 0 : borne;
}

/**
 * Repartit 100 % sur une famille apres qu'un curseur a bouge.
 *
 * Ce qui reste va aux autres boissons cochees, au prorata de ce qu'elles
 * avaient deja, par crans de 5 %. Une part qui tomberait sous le cran passe
 * a zero et laisse sa place aux autres : mieux vaut trois boissons nettes
 * qu'une poussiere de six.
 */
export function repartirGouts(
  parts: ReadonlyMap<string, number>,
  boissonId: string,
  valeur: number,
): Map<string, number> {
  const cible = arrondirPart(valeur);
  const autres = [...parts.entries()].filter(([id, part]) => id !== boissonId && part > 0);
  const sortie = new Map<string, number>();

  // Personne d'autre a servir : la boisson prend tout, ou la famille est vide.
  if (autres.length === 0) {
    if (cible > 0) sortie.set(boissonId, 100);
    return sortie;
  }

  if (cible >= 100) return new Map([[boissonId, 100]]);
  if (cible > 0) sortie.set(boissonId, cible);

  const reste = 100 - cible;
  const total = autres.reduce((somme, [, part]) => somme + part, 0);

  // Chacun garde son rang : on descend les parts au cran inferieur, puis on
  // rend les crans manquants aux plus gros restes. La somme fait 100, pile.
  const bruts = autres.map(([id, part]) => ({ id, exact: (part / total) * reste }));
  const arrondis = bruts.map((x) => ({
    ...x,
    cran: Math.floor(x.exact / PAS_GOUT) * PAS_GOUT,
  }));
  let distribue = arrondis.reduce((somme, x) => somme + x.cran, 0);
  const ordre = [...arrondis].sort((a, b) => b.exact - b.cran - (a.exact - a.cran));
  for (const x of ordre) {
    if (distribue >= reste) break;
    x.cran += PAS_GOUT;
    distribue += PAS_GOUT;
  }

  // Les miettes sous le cran ne survivent pas : leur part revient au plus gros.
  const gardes = arrondis.filter((x) => x.cran >= PAS_GOUT);
  const perdu = arrondis.filter((x) => x.cran < PAS_GOUT).reduce((s, x) => s + x.cran, 0);
  if (gardes.length > 0 && perdu > 0) {
    gardes.sort((a, b) => b.cran - a.cran)[0].cran += perdu;
  }
  for (const x of gardes) sortie.set(x.id, x.cran);
  return sortie;
}

/**
 * Ce que les fiches d'avant portaient : d'abord une note de 0 a 4, puis une
 * case cochee a 100. Les deux restent lisibles comme des parts.
 */
export function normaliserGouts(gouts: readonly GoutBoisson[] | undefined): GoutBoisson[] {
  return (gouts ?? [])
    .filter((x) => x.intensite > 0)
    .map((x) => ({
      boissonId: x.boissonId,
      intensite: Math.min(100, x.intensite <= 4 ? x.intensite * 25 : x.intensite),
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

/** Ce qu'elle boit, la plus grosse part en tete. */
export function boissonsBues(gouts: readonly GoutBoisson[]): { libelle: string; part: number }[] {
  const ordre = new Map(BOISSONS_AIMEES.map((x, i) => [x.id, i]));
  return normaliserGouts(gouts)
    .filter((x) => LIBELLE_BOISSON_AIMEE.has(x.boissonId))
    .sort(
      (a, b) =>
        b.intensite - a.intensite || (ordre.get(a.boissonId) ?? 0) - (ordre.get(b.boissonId) ?? 0),
    )
    .map((x) => ({
      libelle: LIBELLE_BOISSON_AIMEE.get(x.boissonId) ?? '',
      part: Math.round(x.intensite),
    }));
}

/** « Biere blonde 60 % · Rhum 40 % » : ce qu'elle boit, en une ligne. */
export function libelleBoissonsAimees(gouts: readonly GoutBoisson[]): string {
  return boissonsBues(gouts)
    .map((x) => `${x.libelle} ${x.part} %`)
    .join(' · ');
}
