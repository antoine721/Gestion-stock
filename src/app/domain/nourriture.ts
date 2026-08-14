import {
  ExtraNourriture,
  IngredientRepas,
  MomentRepas,
  Nourriture,
  Repas,
  UniteIngredient,
} from './models';

/**
 * Nourriture.
 *
 * Meme invariant que le bar : cote besoin on raisonne PAR PERSONNE, en grammes
 * et millilitres, jamais en paquets. Tous les repas s'agregent d'abord (la
 * viande du samedi et celle du dimanche ne font qu'un besoin), et la
 * conversion en paquets n'arrive qu'une fois, a la toute fin, dans
 * coursesCuisine(). Un repas sans ingredients garde un simple cout par
 * personne (pizzas commandees, traiteur).
 */

export const NOURRITURE_PAR_DEFAUT: Nourriture = { repas: [], extras: [] };

export const MOMENTS: readonly { id: MomentRepas; libelle: string; emoji: string }[] = [
  { id: 'petit-dejeuner', libelle: 'Petit dejeuner', emoji: '🥐' },
  { id: 'dejeuner', libelle: 'Midi', emoji: '🍽️' },
  { id: 'diner', libelle: 'Soir', emoji: '🌙' },
];

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

/** Un ingredient d'idee de plat : la meme chose sans identifiant. */
type IdeeIngredient = Omit<IngredientRepas, 'id'>;

function ing(
  nom: string,
  qteParPersonne: number,
  unite: UniteIngredient,
  conditionnement: number,
  prixConditionnement: number,
): IdeeIngredient {
  return { nom, qteParPersonne, unite, conditionnement, prixConditionnement };
}

/**
 * Des plats qui marchent en grande tablee. Chaque idee arrive avec ses
 * ingredients doses par personne — modifiables ensuite : c'est une aide, pas
 * une recette gravee. Le cout par personne ne sert qu'aux plats sans
 * ingredients (pizzas commandees, traiteur...).
 */
export const IDEES_PLATS: readonly {
  nom: string;
  coutParPersonne: number;
  moments: MomentRepas[];
  vegetarienFacile: boolean;
  ingredients: IdeeIngredient[];
}[] = [
  {
    nom: 'Viennoiseries & cafe',
    coutParPersonne: 0,
    moments: ['petit-dejeuner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Viennoiseries', 1.5, 'piece', 10, 8),
      ing('Jus d’orange', 150, 'ml', 1000, 2.2),
      ing('Cafe moulu', 10, 'g', 250, 4),
    ],
  },
  {
    nom: 'Brunch complet',
    coutParPersonne: 0,
    moments: ['petit-dejeuner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Oeufs', 2, 'piece', 12, 3.5),
      ing('Pain', 80, 'g', 400, 1.4),
      ing('Lardons / bacon', 50, 'g', 200, 2.5),
      ing('Jus d’orange', 200, 'ml', 1000, 2.2),
    ],
  },
  {
    nom: 'Barbecue',
    coutParPersonne: 0,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Viande a griller', 180, 'g', 1000, 12),
      ing('Chipolatas / merguez', 2, 'piece', 12, 7),
      ing('Pain', 100, 'g', 400, 1.4),
      ing('Crudites', 100, 'g', 1000, 3.5),
    ],
  },
  {
    nom: 'Pates bolognaise',
    coutParPersonne: 0,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Pates', 120, 'g', 1000, 1.8),
      ing('Boeuf hache', 120, 'g', 1000, 11),
      ing('Sauce tomate', 120, 'ml', 700, 2.2),
      ing('Parmesan', 15, 'g', 200, 4),
    ],
  },
  {
    nom: 'Chili con carne',
    coutParPersonne: 0,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Riz', 90, 'g', 1000, 2.2),
      ing('Boeuf hache', 100, 'g', 1000, 11),
      ing('Haricots rouges', 130, 'g', 800, 1.6),
      ing('Tomates concassees', 130, 'ml', 800, 1.5),
    ],
  },
  {
    nom: 'Curry de legumes',
    coutParPersonne: 0,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Riz', 90, 'g', 1000, 2.2),
      ing('Legumes varies', 250, 'g', 1000, 3),
      ing('Lait de coco', 100, 'ml', 400, 2.3),
    ],
  },
  {
    nom: 'Paella',
    coutParPersonne: 0,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: false,
    ingredients: [
      ing('Riz', 100, 'g', 1000, 2.2),
      ing('Poulet', 120, 'g', 1000, 9),
      ing('Fruits de mer', 100, 'g', 500, 7),
      ing('Poivrons', 80, 'g', 500, 2.5),
    ],
  },
  {
    nom: 'Raclette',
    coutParPersonne: 0,
    moments: ['diner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Fromage a raclette', 200, 'g', 400, 6.5),
      ing('Pommes de terre', 300, 'g', 2500, 3.5),
      ing('Charcuterie', 120, 'g', 300, 5),
      ing('Cornichons', 30, 'g', 350, 2.5),
    ],
  },
  {
    nom: 'Tacos / fajitas',
    coutParPersonne: 0,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Tortillas', 2.5, 'piece', 8, 2.2),
      ing('Poulet', 130, 'g', 1000, 9),
      ing('Fromage rape', 40, 'g', 200, 2.5),
      ing('Crudites', 80, 'g', 1000, 3.5),
    ],
  },
  {
    nom: 'Pizzas commandees',
    coutParPersonne: 9,
    moments: ['diner'],
    vegetarienFacile: true,
    ingredients: [],
  },
  {
    nom: 'Salades composees',
    coutParPersonne: 0,
    moments: ['dejeuner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Salade', 60, 'g', 300, 2),
      ing('Feta / mozzarella', 60, 'g', 200, 2.5),
      ing('Tomates', 120, 'g', 1000, 3),
      ing('Pain', 80, 'g', 400, 1.4),
    ],
  },
  {
    nom: 'Sandwichs / wraps',
    coutParPersonne: 0,
    moments: ['dejeuner'],
    vegetarienFacile: true,
    ingredients: [
      ing('Pain / wraps', 1.2, 'piece', 6, 2.5),
      ing('Jambon / poulet', 80, 'g', 300, 4),
      ing('Crudites', 60, 'g', 1000, 3.5),
    ],
  },
];

export function repasVierge(id: string, jour: number, moment: MomentRepas): Repas {
  return {
    id,
    jour,
    moment,
    plat: '',
    coutParPersonne: 0,
    convives: 0,
    vegetarienPrevu: false,
    notes: '',
    ingredients: [],
  };
}

export function ingredientVierge(id: string): IngredientRepas {
  return { id, nom: '', qteParPersonne: 0, unite: 'g', conditionnement: 0, prixConditionnement: 0 };
}

/** Complete un repas venu de la base avec les champs apparus depuis. */
export function normaliserRepas(brut: Partial<Repas> & { id: string }): Repas {
  return { ...repasVierge(brut.id, brut.jour ?? 1, brut.moment ?? 'diner'), ...brut };
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
    if (x.conditionnement <= 0) return somme;
    const besoin = Math.max(0, x.qteParPersonne) * convives;
    return somme + (besoin / x.conditionnement) * Math.max(0, x.prixConditionnement);
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
  /** Besoin brut agrege sur tous les repas, dans l'unite de l'ingredient. */
  besoin: number;
  conditionnement: number;
  prixConditionnement: number;
  paquets: number;
  prixTotal: number;
  /** Ce qu'il restera une fois les paquets entames (dans l'unite). */
  reste: number;
  /** Les plats qui consomment cet ingredient. */
  plats: string[];
}

/**
 * Agrege les ingredients de TOUS les repas planifies puis convertit en
 * paquets, a la toute fin. Deux repas qui utilisent « riz » ne font qu'une
 * ligne : le premier conditionnement renseigne fait foi.
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
          conditionnement: Math.max(0, ingredient.conditionnement),
          prixConditionnement: Math.max(0, ingredient.prixConditionnement),
          paquets: 0,
          prixTotal: 0,
          reste: 0,
          plats: [repas.plat],
        });
      }
    }
  }

  return [...lignes.values()].map((ligne) => {
    const paquets = ligne.conditionnement > 0 ? Math.ceil(ligne.besoin / ligne.conditionnement) : 0;
    return {
      ...ligne,
      paquets,
      prixTotal: paquets * ligne.prixConditionnement,
      reste: paquets > 0 ? paquets * ligne.conditionnement - ligne.besoin : 0,
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
