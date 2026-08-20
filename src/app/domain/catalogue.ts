import { Boisson, Categorie, Composant, Produit } from './models';

/**
 * Prix et contenances indicatifs, grande distribution France. Ce ne sont que
 * des valeurs de depart : tout est modifiable produit par produit dans l'app.
 */

const base = (produitId: string, ml: number): Composant => ({ produitId, ml, role: 'base' });
const modif = (produitId: string, ml: number): Composant => ({
  produitId,
  ml,
  role: 'modificateur',
});
const dilue = (produitId: string, ml: number): Composant => ({ produitId, ml, role: 'diluant' });

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

export const PRODUITS: readonly Produit[] = [
  // --- Spiritueux generiques : prends la marque que tu veux ----------------
  gen('whisky', 'Whisky', 'spiritueux', 40, 700, 17.9),
  gen('vodka', 'Vodka', 'spiritueux', 37.5, 700, 15.9),
  gen('gin', 'Gin', 'spiritueux', 40, 700, 19.9),
  gen('rhum-blanc', 'Rhum blanc', 'spiritueux', 37.5, 700, 16.5),
  gen('rhum-ambre', 'Rhum ambre', 'spiritueux', 40, 700, 19.9),

  // --- Marques imposees : le produit EST la marque -------------------------
  prod('captain-morgan', 'Captain Morgan Spiced', 'spiritueux', 35, 700, 18.5),
  prod('ricard', 'Ricard', 'spiritueux', 45, 700, 21.5),
  prod('get-27', 'Get 27', 'liqueur', 21, 700, 16.5),
  prod('jagermeister', 'Jagermeister', 'liqueur', 35, 700, 18),
  prod('aperol', 'Aperol', 'liqueur', 11, 1000, 14.5),
  prod('creme-cassis', 'Creme de cassis', 'liqueur', 15, 500, 9.5),
  prod('malibu', 'Malibu (coco)', 'liqueur', 21, 700, 15.5),
  gen('tequila', 'Tequila', 'spiritueux', 38, 700, 21.9),

  // --- Vins ---------------------------------------------------------------
  gen('vin-blanc', 'Vin blanc', 'vin', 12.5, 750, 6.5),
  gen('vin-rouge', 'Vin rouge', 'vin', 13, 750, 6.5),
  gen('rose', 'Rose', 'vin', 12.5, 750, 6),
  gen('prosecco', 'Prosecco', 'vin', 11, 750, 8.9),
  gen('cremant', 'Cremant', 'vin', 12, 750, 9.9),

  // --- Biere : meme breuvage, plusieurs conditionnements -------------------
  fmt('biere-33', 'Biere', 'Bouteille 33 cl', 5, 330, 1.1),
  fmt('biere-50', 'Biere', 'Bouteille 50 cl', 5, 500, 1.6),
  // Un mini-fut coute plus cher au litre ; c'est a partir de 20 L que ca paye.
  fmt('biere-fut-5', 'Biere', 'Mini-fut 5 L', 5, 5000, 20),
  fmt('biere-fut-20', 'Biere', 'Fut 20 L', 5, 20000, 68, true),
  fmt('biere-fut-30', 'Biere', 'Fut 30 L', 5, 30000, 95, true),

  // --- Diluants gazeux ----------------------------------------------------
  soft('coca', 'Coca-Cola (1,5 L)', 1500, 1.8),
  soft('coca-zero', 'Coca-Cola zero (1,5 L)', 1500, 1.8),
  soft('limonade', 'Limonade (1,5 L)', 1500, 1.1),
  soft('tonic', 'Schweppes tonic (1 L)', 1000, 2.2),
  soft('ginger-ale', 'Ginger ale (1 L)', 1000, 1.9),
  soft('eau-gazeuse', 'Eau gazeuse (1 L)', 1000, 0.7),
  soft('eau-plate', 'Eau plate (1,5 L)', 1500, 0.4),
  soft('red-bull', 'Red Bull (25 cl)', 250, 1.5, true),

  // --- Jus ----------------------------------------------------------------
  soft('jus-orange', "Jus d'orange (1 L)", 1000, 1.6),
  soft('jus-pomme', 'Jus de pomme (1 L)', 1000, 1.4),
  soft('jus-ananas', "Jus d'ananas (1 L)", 1000, 1.7),
  soft('jus-cranberry', 'Jus de cranberry (1 L)', 1000, 2.4),
  soft('jus-pamplemousse', 'Jus de pamplemousse (1 L)', 1000, 1.8),
  soft('jus-multifruits', 'Jus multifruits (1 L)', 1000, 1.5),
  soft('jus-abricot', "Nectar d'abricot (1 L)", 1000, 1.6),
  soft('jus-peche', 'Nectar de peche (1 L)', 1000, 1.6),
  soft('jus-tomate', 'Jus de tomate (1 L)', 1000, 1.7),

  // --- Sirops : les dix parfums les plus consommes -------------------------
  sirop('sirop-grenadine', 'Sirop de grenadine'),
  sirop('sirop-menthe', 'Sirop de menthe'),
  sirop('sirop-fraise', 'Sirop de fraise'),
  sirop('sirop-citron', 'Sirop de citron'),
  sirop('sirop-peche', 'Sirop de peche'),
  sirop('sirop-framboise', 'Sirop de framboise'),
  sirop('sirop-cassis', 'Sirop de cassis'),
  sirop('sirop-orgeat', "Sirop d'orgeat (amande)"),
  sirop('sirop-exotique', 'Sirop fruits exotiques'),
  sirop('sirop-citron-vert', 'Sirop de citron vert'),
];

function prod(
  id: string,
  nom: string,
  categorie: Categorie,
  degre: number,
  contenanceMl: number,
  prixEur: number,
  seConserve = true,
): Produit {
  return { id, nom, categorie, degre, contenanceMl, prixEur, seConserve };
}

function gen(
  id: string,
  nom: string,
  categorie: Categorie,
  degre: number,
  contenanceMl: number,
  prixEur: number,
): Produit {
  return { ...prod(id, nom, categorie, degre, contenanceMl, prixEur), generique: true };
}

function fmt(
  id: string,
  nom: string,
  formatNom: string,
  degre: number,
  contenanceMl: number,
  prixEur: number,
  requiertTireuse = false,
): Produit {
  return {
    ...prod(id, nom, 'biere', degre, contenanceMl, prixEur),
    generique: true,
    format: 'biere',
    formatNom,
    requiertTireuse,
    // Un fut perce ne se garde pas : il s'oxyde en quelques jours.
    seConserve: contenanceMl < 5000,
  };
}

function soft(
  id: string,
  nom: string,
  contenanceMl: number,
  prixEur: number,
  seConserve = false,
): Produit {
  return prod(id, nom, 'soft', 0, contenanceMl, prixEur, seConserve);
}

function sirop(id: string, nom: string): Produit {
  return prod(id, nom, 'sirop', 0, 700, 2.4, true);
}

// ---------------------------------------------------------------------------
// Recettes. Le spritz n'est pas un alcool : c'est une recette. Le prosecco
// existe a la fois comme boisson servie seule et comme composant du spritz,
// le moteur agrege les deux sur le meme produit.
// ---------------------------------------------------------------------------

/**
 * Ce qu'on sert. Une entree = un alcool, tel qu'on l'achete et tel qu'on le
 * declare : du rhum, pas un rhum-coca.
 *
 * Le calcul ne fabrique plus de cocktails. Personne ne declare « je bois 2,5
 * vodka orange et 1,5 vodka Red Bull par jour » — on declare qu'on boit de la
 * vodka, et le coca, le jus ou le tonic se choisissent a part, dans l'onglet
 * des diluants. Restent ici les deux composes qui ne s'achetent pas autrement :
 * le kir, qui est toujours du cassis, et le spritz, qui est toujours ses trois
 * bouteilles.
 */
export const BOISSONS: readonly Boisson[] = [
  // --- Biere : un verre = une canette de 33 cl ----------------------------
  boisson('biere', 'Biere', 'biere', 330, 5, [base('biere-33', 330)]),

  // --- Vins & bulles : le verre de 12 cl ----------------------------------
  boisson('vin-rouge', 'Vin rouge', 'vin', 120, 3, [base('vin-rouge', 120)]),
  boisson('vin-blanc', 'Vin blanc', 'vin', 120, 3, [base('vin-blanc', 120)]),
  boisson('rose', 'Rose', 'vin', 120, 4, [base('rose', 120)]),
  boisson('kir', 'Kir', 'vin', 120, 2, [base('vin-blanc', 100), modif('creme-cassis', 20)]),
  // Le spritz porte son eau petillante : elle fait partie de la recette, on
  // ne la choisit pas.
  boisson('spritz', 'Spritz', 'vin', 180, 4, [
    base('prosecco', 90),
    modif('aperol', 60),
    dilue('eau-gazeuse', 30),
  ]),

  // --- Alcools forts : la dose du bar, 4 cl -------------------------------
  boisson('rhum', 'Rhum', 'sec', 40, 3, [base('rhum-blanc', 40)]),
  boisson('captain', 'Captain Morgan', 'sec', 40, 3, [base('captain-morgan', 40)]),
  boisson('vodka', 'Vodka', 'sec', 40, 3, [base('vodka', 40)]),
  boisson('gin', 'Gin', 'sec', 40, 3, [base('gin', 40)]),
  boisson('whisky', 'Whisky', 'sec', 40, 3, [base('whisky', 40)]),
  boisson('tequila', 'Tequila', 'sec', 40, 2, [base('tequila', 40)]),
  // Le pastis se sert plus court, et se noie dans cinq volumes d'eau.
  boisson('pastis', 'Ricard / Pastis', 'sec', 25, 3, [base('ricard', 25)]),
  boisson('get', 'Get 27', 'sec', 40, 2, [base('get-27', 40)]),
  boisson('jager', 'Jagermeister', 'sec', 40, 2, [base('jagermeister', 40)]),
  boisson('malibu', 'Malibu', 'sec', 40, 2, [base('malibu', 40)]),

  // --- Sans alcool : les non-buveurs boivent aussi -------------------------
  boisson('diabolo', 'Diabolo (limonade / sirop)', 'soft', 250, 3, [
    base('limonade', 220),
    modif('sirop-grenadine', 30),
  ]),
  boisson('soft-jus', 'Jus de fruits', 'soft', 200, 3, [base('jus-multifruits', 200)]),
  boisson('soft-soda', 'Soda', 'soft', 250, 3, [base('coca', 250)]),
  boisson('soft-eau', 'Eau petillante', 'soft', 250, 2, [base('eau-gazeuse', 250)]),
];

function boisson(
  id: string,
  nom: string,
  famille: Boisson['famille'],
  verreMl: number,
  popularite: number,
  composants: Composant[],
): Boisson {
  return { id, nom, famille, verreMl, popularite, composants };
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

export const PRODUIT_PAR_ID = new Map(PRODUITS.map((x) => [x.id, x]));

/**
 * Ce avec quoi on coupe l'alcool : colas, tonics, jus, eaux. Les sirops ont
 * leur propre categorie — on ne remplit pas un verre avec de la grenadine.
 */
export const PRODUITS_DILUANTS = PRODUITS.filter((x) => x.categorie === 'soft');
export const BOISSON_PAR_ID = new Map(BOISSONS.map((x) => [x.id, x]));

/** Derive du catalogue : une boisson est alcoolisee si un composant l'est. */
export const BOISSONS_ALCOOLISEES = new Set(
  BOISSONS.filter((boisson) =>
    boisson.composants.some((c) => (PRODUIT_PAR_ID.get(c.produitId)?.degre ?? 0) > 0),
  ).map((x) => x.id),
);

/** formatId -> les conditionnements disponibles, dans l'ordre du catalogue. */
export const PRODUITS_PAR_FORMAT = PRODUITS.reduce((acc, produit) => {
  if (!produit.format) return acc;
  const liste = acc.get(produit.format);
  if (liste) liste.push(produit);
  else acc.set(produit.format, [produit]);
  return acc;
}, new Map<string, Produit[]>());

export const LIBELLE_FAMILLE: Record<Boisson['famille'], string> = {
  cocktail: 'Cocktails & longs drinks',
  biere: 'Bieres',
  vin: 'Vins & bulles',
  sec: 'Secs / on the rocks',
  shot: 'Shots',
  soft: 'Sans alcool',
};

export const ORDRE_FAMILLE: readonly Boisson['famille'][] = [
  'cocktail',
  'biere',
  'vin',
  'sec',
  'shot',
  'soft',
];

export const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  spiritueux: 'Spiritueux',
  liqueur: 'Liqueurs & aperitifs',
  vin: 'Vins & bulles',
  biere: 'Bieres',
  soft: 'Softs & diluants',
  sirop: 'Sirops',
};

export const ORDRE_CATEGORIE: readonly Categorie[] = [
  'spiritueux',
  'liqueur',
  'vin',
  'biere',
  'soft',
  'sirop',
];
