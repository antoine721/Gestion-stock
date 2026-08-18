import { Categorie, CategorieCourse } from './models';

/**
 * Les rayons de la liste de courses, et leur couleur.
 *
 * Une categorie sert a deux choses : separer le total (« combien part dans
 * l'alcool ? ») et teinter les lignes pour qu'on repere un rayon sans lire.
 * Les couleurs sortent du design system de l'app, et l'ordre ci-dessous est
 * celui des parts du camembert : il a ete choisi pour que deux teintes
 * voisines restent distinguables, y compris pour les daltonismes courants.
 *
 * La couleur ne porte jamais l'information seule : chaque part est legendee,
 * chaque ligne affiche le nom de son rayon.
 */
export interface OptionCategorieCourse {
  id: CategorieCourse;
  libelle: string;
  emoji: string;
  /** Le nom de la teinte, qui devient la variable CSS `--teinte-<nom>`. */
  teinte: string;
}

export const CATEGORIES_COURSE: readonly OptionCategorieCourse[] = [
  { id: 'alcool', libelle: 'Alcool', emoji: '🍾', teinte: 'bleu' },
  { id: 'nourriture', libelle: 'Nourriture', emoji: '🍽️', teinte: 'orange' },
  { id: 'soft', libelle: 'Sans alcool', emoji: '🥤', teinte: 'vert' },
  { id: 'intendance', libelle: 'Intendance', emoji: '🧻', teinte: 'fuchsia' },
  { id: 'jetable', libelle: 'Vaisselle jetable', emoji: '🍽', teinte: 'olive-courses' },
  { id: 'materiel', libelle: 'Materiel', emoji: '🛠️', teinte: 'rose' },
  // « Autre » est volontairement neutre : c'est le fourre-tout, pas un rayon.
  { id: 'autre', libelle: 'Autre', emoji: '📦', teinte: 'neutre' },
];

export const CATEGORIE_COURSE_PAR_ID = new Map(CATEGORIES_COURSE.map((x) => [x.id, x]));

export function libelleCategorieCourse(id: CategorieCourse): string {
  return CATEGORIE_COURSE_PAR_ID.get(id)?.libelle ?? 'Autre';
}

/** Le rayon d'un produit du bar : ce qui titre va dans l'alcool, le reste au soft. */
export function categorieDuProduit(categorie: Categorie): CategorieCourse {
  return categorie === 'soft' || categorie === 'sirop' ? 'soft' : 'alcool';
}

export interface PartCategorie {
  categorie: CategorieCourse;
  libelle: string;
  teinte: string;
  montant: number;
  /** Part du total, en pourcentage. */
  part: number;
  lignes: number;
}

/**
 * Le total des courses, rayon par rayon. Les rayons vides ne sortent pas :
 * une part a zero n'apprend rien et vole une couleur a une vraie part.
 */
export function repartirParCategorie(
  lignes: readonly { categorie: CategorieCourse; prix: number }[],
): PartCategorie[] {
  const total = lignes.reduce((somme, x) => somme + Math.max(0, x.prix), 0);
  return CATEGORIES_COURSE.map((option) => {
    const duRayon = lignes.filter((x) => x.categorie === option.id);
    const montant = duRayon.reduce((somme, x) => somme + Math.max(0, x.prix), 0);
    return {
      categorie: option.id,
      libelle: option.libelle,
      teinte: option.teinte,
      montant,
      part: total > 0 ? (montant / total) * 100 : 0,
      lignes: duRayon.length,
    };
  }).filter((x) => x.montant > 0);
}
