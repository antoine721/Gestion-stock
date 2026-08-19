import { CategorieCourse, UniteAchat } from './models';

/**
 * Le catalogue de produits du rayon.
 *
 * Les produits viennent d'un relevé de rayon de supermarché, traduit et
 * resserré à la main sur ce qui sert vraiment a un festival : boire, manger,
 * nettoyer, jeter. Il tient dans un fichier, donc la recherche est locale et
 * instantanee — aucun appel reseau, rien qui puisse tomber pendant les
 * courses.
 *
 * Le prix est celui du releve : un ordre de grandeur pour se reperer, pas une
 * verite. Il reste modifiable a l'ajout, parce que c'est le ticket de caisse
 * qui tranche.
 */
export interface ProduitCatalogue {
  code: string;
  nom: string;
  marque: string;
  imageUrl: string;
  categorie: CategorieCourse;
  /** Ce que contient une unite : 330 (ml), 1,5 (L), 0 si ca se compte a la piece. */
  contenance: number;
  unite: UniteAchat;
  /** Ce que dit l'emballage : « 12 rouleaux », « canette », « 3 x 215 g ». */
  conditionnement: string;
  prix: number;
}

/** Sans accents ni majuscules : on cherche « biere » et on trouve « Bière ». */
export function normaliserTexte(texte: string): string {
  return (
    texte
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      // « œufs » se cherche « oeufs » : personne ne tape la ligature.
      .replace(/\u0153/g, 'oe')
      .replace(/\u00e6/g, 'ae')
  );
}

/**
 * Ce qu'on tape reellement, et le mot du catalogue derriere.
 *
 * Personne n'ecrit « papier toilette » dans une barre de recherche a deux
 * heures du matin. Sans cette table, la moitie des recherches ne renvoient
 * rien alors que le produit est bien la.
 */
const SYNONYMES: readonly { saisi: RegExp; catalogue: string }[] = [
  { saisi: /\bpq\b/g, catalogue: 'papier toilette' },
  { saisi: /\bpapier cul\b/g, catalogue: 'papier toilette' },
  { saisi: /\bsopalin\b/g, catalogue: 'essuie-tout' },
  { saisi: /\bcoca\b/g, catalogue: 'cola' },
  { saisi: /\bpinard\b/g, catalogue: 'vin' },
  { saisi: /\bmousseux\b/g, catalogue: 'cava' },
  { saisi: /\bchampagne\b/g, catalogue: 'cava' },
  { saisi: /\bpicon\b/g, catalogue: 'biere' },
  { saisi: /\bglace\b/g, catalogue: 'glacons' },
  { saisi: /\bcubes? de glace\b/g, catalogue: 'glacons' },
  { saisi: /\bcharbon de bois\b/g, catalogue: 'charbon' },
  { saisi: /\bbarbecue\b/g, catalogue: 'charbon' },
  { saisi: /\bgobelet\b/g, catalogue: 'gobelets' },
  { saisi: /\bverres? en carton\b/g, catalogue: 'gobelets carton' },
  { saisi: /\bassiettes?\b/g, catalogue: 'jetable' },
  { saisi: /\bproduit vaisselle\b/g, catalogue: 'liquide vaisselle' },
  { saisi: /\bcacahuetes?\b/g, catalogue: 'cacahuetes' },
  { saisi: /\bapero\b/g, catalogue: 'aperitif' },
  { saisi: /\bpoubelles?\b/g, catalogue: 'sacs poubelle' },
];

function traduireSaisie(requete: string): string {
  let texte = normaliserTexte(requete);
  for (const { saisi, catalogue } of SYNONYMES) {
    texte = texte.replace(saisi, catalogue);
  }
  return texte;
}

/** Ce sur quoi on cherche : le nom, la marque, et ce que dit l'emballage. */
function bottePaille(produit: ProduitCatalogue): string {
  return normaliserTexte(`${produit.nom} ${produit.marque} ${produit.conditionnement}`);
}

/**
 * Combien un produit repond a la requete, 0 s'il n'y repond pas.
 *
 * Tous les mots tapes doivent etre presents : chercher « biere sans alcool »
 * ne doit pas remonter toutes les bieres. Un mot entier compte plus qu'un
 * debut de mot, pour que « vin » sorte les vins avant les vinaigres.
 */
function noter(produit: ProduitCatalogue, mots: readonly string[]): number {
  const paille = bottePaille(produit);
  const motsPaille = paille.split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  for (const mot of mots) {
    if (motsPaille.includes(mot)) score += 3;
    else if (motsPaille.some((x) => x.startsWith(mot))) score += 2;
    else if (paille.includes(mot)) score += 1;
    else return 0;
  }
  // Un produit dont le nom COMMENCE par le mot tape est celui qu'on visait :
  // « vin » veut dire le vin rouge, pas le vinaigre de vin.
  const premierMot = normaliserTexte(produit.nom).split(/[^a-z0-9]+/)[0];
  if (premierMot === mots[0]) score += 2;
  return score;
}

export const LIMITE_RESULTATS = 24;

/**
 * Les produits qui repondent a la requete, les plus pertinents d'abord.
 *
 * A egalite, le nom le plus court gagne : c'est le produit generique, celui
 * qu'on cherchait, avant ses declinaisons.
 */
export function chercherProduits(
  catalogue: readonly ProduitCatalogue[],
  requete: string,
  limite = LIMITE_RESULTATS,
): ProduitCatalogue[] {
  const mots = traduireSaisie(requete)
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length > 0);
  if (mots.length === 0) return [];

  const notes: { produit: ProduitCatalogue; score: number }[] = [];
  for (const produit of catalogue) {
    const score = noter(produit, mots);
    if (score > 0) notes.push({ produit, score });
  }
  notes.sort(
    (a, b) =>
      b.score - a.score ||
      a.produit.nom.length - b.produit.nom.length ||
      a.produit.prix - b.produit.prix,
  );
  return notes.slice(0, limite).map((x) => x.produit);
}

/**
 * Complete un produit du fichier : si le catalogue evolue, une entree
 * incomplete ne doit pas casser l'ecran de courses.
 */
export function normaliserProduitCatalogue(brut: Partial<ProduitCatalogue>): ProduitCatalogue {
  return {
    code: brut.code ?? '',
    nom: brut.nom ?? '',
    marque: brut.marque ?? '',
    imageUrl: brut.imageUrl ?? '',
    categorie: brut.categorie ?? 'autre',
    contenance: Number.isFinite(brut.contenance) ? Number(brut.contenance) : 0,
    unite: brut.unite ?? 'piece',
    conditionnement: brut.conditionnement ?? '',
    prix: Number.isFinite(brut.prix) ? Number(brut.prix) : 0,
  };
}
