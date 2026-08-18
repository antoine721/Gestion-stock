import {
  ExtraNourriture,
  IngredientRepas,
  MomentRepas,
  Nourriture,
  Repas,
  TypePlat,
  UniteIngredient,
} from './models';

/**
 * Nourriture.
 *
 * Meme invariant que le bar : cote besoin on raisonne PAR PERSONNE, en grammes
 * et millilitres. Tous les repas s'agregent d'abord (la viande du samedi et
 * celle du dimanche ne font qu'un besoin), et l'arrondi a l'unite d'achat —
 * des kilos, des litres, des pieces ENTIERS — n'arrive qu'une fois, a la toute
 * fin, dans coursesCuisine(). On n'achete pas 1,4 kg de viande : on en achete
 * 2. Un repas sans ingredients garde un simple cout par personne (pizzas
 * commandees, traiteur).
 */

export const NOURRITURE_PAR_DEFAUT: Nourriture = { repas: [], extras: [] };

export const MOMENTS: readonly { id: MomentRepas; libelle: string; emoji: string }[] = [
  { id: 'petit-dejeuner', libelle: 'Petit dejeuner', emoji: '🥐' },
  { id: 'dejeuner', libelle: 'Midi', emoji: '🍽️' },
  { id: 'diner', libelle: 'Soir', emoji: '🌙' },
];

/**
 * La forme du repas. Elle ne change pas le calcul — les ingredients restent
 * doses par personne — mais elle dit d'un coup d'oeil comment on cuisine, et
 * ce qu'il faudra sortir : le barbecue, l'appareil a raclette, les glacieres.
 */
export const TYPES_PLAT: readonly { id: TypePlat; libelle: string; emoji: string }[] = [
  { id: 'a-definir', libelle: 'A definir', emoji: '❓' },
  { id: 'barbecue', libelle: 'Barbecue', emoji: '🔥' },
  { id: 'plancha', libelle: 'Plancha', emoji: '🍳' },
  { id: 'buffet-froid', libelle: 'Buffet froid', emoji: '🥗' },
  { id: 'plat-mijote', libelle: 'Plat mijote', emoji: '🍲' },
  { id: 'pates', libelle: 'Pates / riz', emoji: '🍝' },
  { id: 'salade', libelle: 'Salade composee', emoji: '🥙' },
  { id: 'raclette', libelle: 'Raclette / fondue', emoji: '🧀' },
  { id: 'brunch', libelle: 'Brunch', emoji: '🥞' },
  { id: 'petit-dejeuner', libelle: 'Petit dejeuner', emoji: '🥐' },
  { id: 'pizza', libelle: 'Pizzas', emoji: '🍕' },
  { id: 'traiteur', libelle: 'Traiteur / livraison', emoji: '🚚' },
  { id: 'autre', libelle: 'Autre', emoji: '🍴' },
];

export const LIBELLE_TYPE_PLAT: Record<TypePlat, string> = Object.fromEntries(
  TYPES_PLAT.map((x) => [x.id, x.libelle]),
) as Record<TypePlat, string>;

export const EMOJI_TYPE_PLAT: Record<TypePlat, string> = Object.fromEntries(
  TYPES_PLAT.map((x) => [x.id, x.emoji]),
) as Record<TypePlat, string>;

export const LIBELLE_MOMENT: Record<MomentRepas, string> = {
  'petit-dejeuner': 'Petit dejeuner',
  dejeuner: 'Midi',
  diner: 'Soir',
};

export const UNITES_INGREDIENT: readonly { id: UniteIngredient; libelle: string }[] = [
  { id: 'g', libelle: 'g' },
  { id: 'ml', libelle: 'ml' },
  { id: 'piece', libelle: 'piece(s)' },
];

/**
 * Combien d'unites de dosage tient une unite d'ACHAT. On dose en grammes et en
 * millilitres, on achete au kilo et au litre — c'est la seule conversion du
 * module, et elle n'arrive qu'a la fin, sur le besoin agrege.
 */
export const PAS_ACHAT: Record<UniteIngredient, number> = { g: 1000, ml: 1000, piece: 1 };

/** L'unite dans laquelle on remplit le caddie, et dans laquelle on paie. */
export const UNITE_ACHAT: Record<UniteIngredient, string> = {
  g: 'kg',
  ml: 'L',
  piece: 'piece(s)',
};

/** « € / kg », « € / L », « € / piece » — l'intitule du prix a saisir. */
export const LIBELLE_PRIX: Record<UniteIngredient, string> = {
  g: '€/kg',
  ml: '€/L',
  piece: '€/piece',
};

export function repasVierge(id: string, jour: number, moment: MomentRepas): Repas {
  return {
    id,
    jour,
    moment,
    typePlat: 'a-definir',
    plat: '',
    coutParPersonne: 0,
    convives: 0,
    vegetarienPrevu: false,
    notes: '',
    ingredients: [],
  };
}

export function ingredientVierge(id: string): IngredientRepas {
  return { id, nom: '', qteParPersonne: 0, unite: 'g', prixUnitaire: 0 };
}

/**
 * Complete un repas venu de la base avec les champs apparus depuis. Les
 * ingredients d'avant le prix au kilo portaient un couple taille de paquet /
 * prix du paquet : on en deduit le prix unitaire plutot que de perdre la ligne.
 */
export function normaliserRepas(brut: Partial<Repas> & { id: string }): Repas {
  const repas = { ...repasVierge(brut.id, brut.jour ?? 1, brut.moment ?? 'diner'), ...brut };
  return {
    ...repas,
    ingredients: (repas.ingredients ?? []).map((x) => {
      const ancien = x as Partial<IngredientRepas> & {
        conditionnement?: number;
        prixConditionnement?: number;
      };
      if (typeof ancien.prixUnitaire === 'number') return { ...ingredientVierge(x.id), ...x };
      const taille = Math.max(0, ancien.conditionnement ?? 0);
      const prixPaquet = Math.max(0, ancien.prixConditionnement ?? 0);
      const unite = ancien.unite ?? 'g';
      const prixUnitaire = taille > 0 ? (prixPaquet / taille) * PAS_ACHAT[unite] : 0;
      return { ...ingredientVierge(x.id), ...x, unite, prixUnitaire };
    }),
  };
}

export function extraNourritureVierge(id: string): ExtraNourriture {
  return { id, nom: '', quantite: 1, prixUnitaire: 0 };
}

/** Le repas prevu pour une case jour x moment, s'il existe. */
export function repasPour(
  nourriture: Nourriture,
  jour: number,
  moment: MomentRepas,
): Repas | undefined {
  return nourriture.repas.find((x) => x.jour === jour && x.moment === moment);
}

function convivesDe(repas: Repas, invites: number): number {
  return repas.convives > 0 ? repas.convives : Math.max(0, invites);
}

/**
 * Le cout BRUT d'un repas, avant arrondi en paquets : ingredients au prorata
 * de leur prix au gramme, ou cout par personne a defaut. C'est l'equivalent du
 * besoin en millilitres du bar — le prix d'achat reel sort de coursesCuisine().
 */
export function coutDuRepas(repas: Repas, invites: number): number {
  const convives = convivesDe(repas, invites);
  if (repas.ingredients.length === 0) return convives * Math.max(0, repas.coutParPersonne);

  return repas.ingredients.reduce((somme, x) => {
    const besoin = Math.max(0, x.qteParPersonne) * convives;
    return somme + (besoin / PAS_ACHAT[x.unite]) * Math.max(0, x.prixUnitaire);
  }, 0);
}

export function coutDesExtras(extras: readonly ExtraNourriture[]): number {
  return extras.reduce(
    (somme, x) => somme + Math.max(0, x.quantite) * Math.max(0, x.prixUnitaire),
    0,
  );
}

// ---------------------------------------------------------------------------
// Courses cuisine : le besoin agrege, converti en paquets une seule fois
// ---------------------------------------------------------------------------

export interface LigneCuisine {
  /** Cle stable de la ligne, pour la liste de courses unifiee. */
  cle: string;
  nom: string;
  unite: UniteIngredient;
  /** Besoin theorique agrege sur tous les repas, dans l'unite de dosage. */
  besoin: number;
  /** Prix dans l'unite d'achat : au kilo, au litre, ou a la piece. */
  prixUnitaire: number;
  /**
   * Ce qu'on met dans le caddie : des kilos, des litres ou des pieces ENTIERS.
   * On n'achete pas 1,4 kg de viande — on en achete 2.
   */
  quantiteAchat: number;
  /** L'unite du caddie : « kg », « L », « piece(s) ». */
  uniteAchat: string;
  prixTotal: number;
  /** Ce qu'il restera une fois l'arrondi fait, dans l'unite de dosage. */
  reste: number;
  /** Les plats qui consomment cet ingredient. */
  plats: string[];
}

/**
 * Agrege les ingredients de TOUS les repas planifies puis arrondit a l'unite
 * d'achat, a la toute fin. Deux repas qui utilisent « riz » ne font qu'une
 * ligne — et donc un seul arrondi : le premier prix renseigne fait foi.
 */
export function coursesCuisine(
  nourriture: Nourriture,
  invites: number,
  jours: number,
): LigneCuisine[] {
  const duree = Math.max(1, jours);
  const lignes = new Map<string, LigneCuisine>();

  for (const repas of nourriture.repas) {
    if (repas.plat.trim().length === 0 || repas.jour < 1 || repas.jour > duree) continue;
    const convives = convivesDe(repas, invites);

    for (const ingredient of repas.ingredients) {
      const besoin = Math.max(0, ingredient.qteParPersonne) * convives;
      if (besoin === 0) continue;

      const cle = `${ingredient.nom.trim().toLowerCase()}|${ingredient.unite}`;
      const existante = lignes.get(cle);
      if (existante) {
        existante.besoin += besoin;
        if (!existante.plats.includes(repas.plat)) existante.plats.push(repas.plat);
      } else {
        lignes.set(cle, {
          cle,
          nom: ingredient.nom.trim(),
          unite: ingredient.unite,
          besoin,
          prixUnitaire: Math.max(0, ingredient.prixUnitaire),
          quantiteAchat: 0,
          uniteAchat: UNITE_ACHAT[ingredient.unite],
          prixTotal: 0,
          reste: 0,
          plats: [repas.plat],
        });
      }
    }
  }

  return [...lignes.values()].map((ligne) => {
    // On ne compte pas les virgules : 1,4 kg de viande se traduit par 2 kg dans
    // le caddie. L'arrondi n'arrive qu'ici, sur le besoin de TOUS les repas.
    const pas = PAS_ACHAT[ligne.unite];
    const quantiteAchat = Math.ceil(ligne.besoin / pas);
    return {
      ...ligne,
      quantiteAchat,
      prixTotal: quantiteAchat * ligne.prixUnitaire,
      reste: quantiteAchat * pas - ligne.besoin,
    };
  });
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export interface BudgetNourriture {
  /** Prix d'achat des repas : paquets arrondis + forfaits par personne. */
  coutRepas: number;
  coutExtras: number;
  total: number;
  /** Repas dont le plat est decide. */
  repasPrevus: number;
  /** Cases jour x moment encore vides sur la duree de l'evenement. */
  repasManquants: number;
}

export function budgetNourriture(
  nourriture: Nourriture,
  invites: number,
  jours: number,
): BudgetNourriture {
  const duree = Math.max(1, jours);
  const prevus = nourriture.repas.filter(
    (x) => x.plat.trim().length > 0 && x.jour >= 1 && x.jour <= duree,
  );

  const coutForfaits = prevus
    .filter((x) => x.ingredients.length === 0)
    .reduce((somme, x) => somme + coutDuRepas(x, invites), 0);
  const coutIngredients = coursesCuisine(nourriture, invites, jours).reduce(
    (somme, x) => somme + x.prixTotal,
    0,
  );

  const coutRepas = coutForfaits + coutIngredients;
  const coutExtras = coutDesExtras(nourriture.extras);
  return {
    coutRepas,
    coutExtras,
    total: coutRepas + coutExtras,
    repasPrevus: prevus.length,
    repasManquants: duree * MOMENTS.length - prevus.length,
  };
}
