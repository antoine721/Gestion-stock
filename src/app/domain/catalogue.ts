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

export const BOISSONS: readonly Boisson[] = [
  boisson('biere', 'Biere', 'biere', 330, 5, [base('biere-33', 330)]),
  boisson('spritz', 'Spritz', 'cocktail', 180, 4, [
    base('prosecco', 90),
    modif('aperol', 60),
    dilue('eau-gazeuse', 30),
  ]),
  boisson('whisky-coca', 'Whisky coca', 'cocktail', 190, 4, [
    base('whisky', 40),
    dilue('coca', 150),
  ]),
  boisson('whisky-sec', 'Whisky sec', 'sec', 40, 2, [base('whisky', 40)]),
  boisson('ricard', 'Ricard', 'cocktail', 150, 3, [base('ricard', 25), dilue('eau-plate', 125)]),
  boisson('rhum-coca', 'Rhum coca', 'cocktail', 190, 3, [
    base('rhum-blanc', 40),
    dilue('coca', 150),
  ]),
  boisson('captain-coca', 'Captain coca', 'cocktail', 190, 3, [
    base('captain-morgan', 40),
    dilue('coca', 150),
  ]),
  boisson('rhum-ananas', 'Rhum ananas', 'cocktail', 190, 2, [
    base('rhum-ambre', 40),
    dilue('jus-ananas', 150),
  ]),
  boisson('mojito', 'Mojito', 'cocktail', 200, 3, [
    base('rhum-blanc', 50),
    modif('sirop-citron-vert', 20),
    dilue('eau-gazeuse', 130),
  ]),
  boisson('malibu-ananas', 'Malibu ananas', 'cocktail', 190, 2, [
    base('malibu', 40),
    dilue('jus-ananas', 150),
  ]),
  boisson('vodka-orange', 'Vodka orange', 'cocktail', 190, 3, [
    base('vodka', 40),
    dilue('jus-orange', 150),
  ]),
  boisson('vodka-ananas', 'Vodka ananas', 'cocktail', 190, 2, [
    base('vodka', 40),
    dilue('jus-ananas', 150),
  ]),
  boisson('vodka-cranberry', 'Vodka cranberry', 'cocktail', 190, 2, [
    base('vodka', 40),
    dilue('jus-cranberry', 150),
  ]),
  boisson('vodka-pamplemousse', 'Vodka pamplemousse', 'cocktail', 190, 2, [
    base('vodka', 40),
    dilue('jus-pamplemousse', 150),
  ]),
  boisson('vodka-redbull', 'Vodka Red Bull', 'cocktail', 165, 2, [
    base('vodka', 40),
    dilue('red-bull', 125),
  ]),
  boisson('vodka-shot', 'Shot de vodka', 'shot', 40, 2, [base('vodka', 40)]),
  boisson('gin-tonic', 'Gin tonic', 'cocktail', 195, 3, [base('gin', 45), dilue('tonic', 150)]),
  boisson('get-limonade', 'Get limonade', 'cocktail', 190, 2, [
    base('get-27', 40),
    dilue('limonade', 150),
  ]),
  boisson('get-sec', 'Get 27 sec', 'sec', 50, 1, [base('get-27', 50)]),
  boisson('jagger-shot', 'Shot de Jagermeister', 'shot', 40, 2, [base('jagermeister', 40)]),
  boisson('monaco', 'Monaco', 'biere', 330, 2, [
    base('biere-33', 250),
    dilue('limonade', 60),
    modif('sirop-grenadine', 20),
  ]),
  boisson('tango', 'Tango (biere grenadine)', 'biere', 300, 2, [
    base('biere-33', 280),
    modif('sirop-grenadine', 20),
  ]),
  boisson('vin-blanc', 'Vin blanc', 'vin', 120, 3, [base('vin-blanc', 120)]),
  boisson('vin-rouge', 'Vin rouge', 'vin', 120, 3, [base('vin-rouge', 120)]),
  boisson('rose', 'Rose', 'vin', 120, 4, [base('rose', 120)]),
  boisson('prosecco-coupe', 'Prosecco (coupe)', 'vin', 100, 2, [base('prosecco', 100)]),
  boisson('cremant-coupe', 'Cremant (coupe)', 'vin', 100, 2, [base('cremant', 100)]),
  boisson('kir', 'Kir (blanc / cassis)', 'cocktail', 120, 2, [
    base('vin-blanc', 100),
    modif('creme-cassis', 20),
  ]),

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
