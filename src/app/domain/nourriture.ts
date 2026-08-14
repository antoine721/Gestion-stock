import { ExtraNourriture, MomentRepas, Nourriture, Repas } from './models';

/**
 * Nourriture.
 *
 * Meme logique que l'alcool : on raisonne par personne et par repas, jamais
 * en kilos de pates. Le total suit le nombre d'invites tout seul, et la
 * conversion en courses reste le probleme du cuisinier.
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

/**
 * Des plats qui marchent en grande tablee, avec un cout par personne realiste
 * pour pre-remplir. Le cout reste modifiable : c'est une aide, pas un tarif.
 */
export const IDEES_PLATS: readonly {
  nom: string;
  coutParPersonne: number;
  moments: MomentRepas[];
  vegetarienFacile: boolean;
}[] = [
  {
    nom: 'Viennoiseries & cafe',
    coutParPersonne: 2.5,
    moments: ['petit-dejeuner'],
    vegetarienFacile: true,
  },
  {
    nom: 'Brunch complet',
    coutParPersonne: 6,
    moments: ['petit-dejeuner'],
    vegetarienFacile: true,
  },
  { nom: 'Barbecue', coutParPersonne: 7, moments: ['dejeuner', 'diner'], vegetarienFacile: true },
  {
    nom: 'Pates bolognaise',
    coutParPersonne: 3,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
  },
  {
    nom: 'Chili con carne',
    coutParPersonne: 4,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
  },
  {
    nom: 'Curry de legumes',
    coutParPersonne: 3.5,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
  },
  { nom: 'Paella', coutParPersonne: 6.5, moments: ['dejeuner', 'diner'], vegetarienFacile: false },
  { nom: 'Raclette', coutParPersonne: 8, moments: ['diner'], vegetarienFacile: true },
  {
    nom: 'Tacos / fajitas',
    coutParPersonne: 5,
    moments: ['dejeuner', 'diner'],
    vegetarienFacile: true,
  },
  { nom: 'Pizzas commandees', coutParPersonne: 9, moments: ['diner'], vegetarienFacile: true },
  { nom: 'Salades composees', coutParPersonne: 4, moments: ['dejeuner'], vegetarienFacile: true },
  { nom: 'Sandwichs / wraps', coutParPersonne: 3.5, moments: ['dejeuner'], vegetarienFacile: true },
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

export function coutDuRepas(repas: Repas, invites: number): number {
  const convives = repas.convives > 0 ? repas.convives : Math.max(0, invites);
  return convives * Math.max(0, repas.coutParPersonne);
}

export function coutDesExtras(extras: readonly ExtraNourriture[]): number {
  return extras.reduce(
    (somme, x) => somme + Math.max(0, x.quantite) * Math.max(0, x.prixUnitaire),
    0,
  );
}

export interface BudgetNourriture {
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
  const coutRepas = prevus.reduce((somme, x) => somme + coutDuRepas(x, invites), 0);
  const coutExtras = coutDesExtras(nourriture.extras);
  return {
    coutRepas,
    coutExtras,
    total: coutRepas + coutExtras,
    repasPrevus: prevus.length,
    repasManquants: duree * MOMENTS.length - prevus.length,
  };
}
