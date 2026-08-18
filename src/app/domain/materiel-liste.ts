import { Article, CategorieArticle, ModeArticle, StatutArticle } from './models';

/**
 * Materiel : location et achat.
 *
 * Tout ce qui coute de l'argent sans se boire ni se manger : decoration,
 * generateur, sono, tables... La caution est suivie a part : c'est de
 * l'argent avance puis rendu, pas une depense.
 */

export const CATEGORIES_ARTICLE: readonly {
  id: CategorieArticle;
  libelle: string;
  emoji: string;
}[] = [
  { id: 'decoration', libelle: 'Decoration', emoji: '🎈' },
  { id: 'electricite', libelle: 'Electricite', emoji: '🔌' },
  { id: 'sono', libelle: 'Son & lumiere', emoji: '🔊' },
  { id: 'mobilier', libelle: 'Mobilier', emoji: '🪑' },
  { id: 'cuisine', libelle: 'Cuisine', emoji: '🍳' },
  { id: 'vaisselle', libelle: 'Vaisselle', emoji: '🥤' },
  { id: 'intendance', libelle: 'Intendance', emoji: '🧻' },
  { id: 'transport', libelle: 'Transport', emoji: '🚚' },
  { id: 'hebergement', libelle: 'Hebergement', emoji: '⛺' },
  { id: 'autre', libelle: 'Autre', emoji: '📦' },
];

export const LIBELLE_CATEGORIE_ARTICLE: Record<CategorieArticle, string> = Object.fromEntries(
  CATEGORIES_ARTICLE.map((x) => [x.id, x.libelle]),
) as Record<CategorieArticle, string>;

export const MODES_ARTICLE: readonly { id: ModeArticle; libelle: string }[] = [
  { id: 'achat', libelle: 'Achat' },
  { id: 'location', libelle: 'Location' },
];

export const STATUTS_ARTICLE: readonly { id: StatutArticle; libelle: string }[] = [
  { id: 'a-prevoir', libelle: 'A prevoir' },
  { id: 'reserve', libelle: 'Reserve' },
  { id: 'achete', libelle: 'Achete' },
  { id: 'recupere', libelle: 'Recupere' },
];

export const LIBELLE_STATUT_ARTICLE: Record<StatutArticle, string> = Object.fromEntries(
  STATUTS_ARTICLE.map((x) => [x.id, x.libelle]),
) as Record<StatutArticle, string>;

export function articleVierge(id: string): Article {
  return {
    id,
    nom: '',
    categorie: 'autre',
    mode: 'achat',
    statut: 'a-prevoir',
    quantite: 1,
    qteParPersonne: 0,
    prixUnitaire: 0,
    caution: 0,
    payeParId: '',
    notes: '',
    refCatalogue: '',
    imageUrl: '',
  };
}

export function coutArticle(article: Article): number {
  return Math.max(0, article.quantite) * Math.max(0, article.prixUnitaire);
}

export interface BudgetMateriel {
  total: number;
  totalAchat: number;
  totalLocation: number;
  /** Cautions a avancer : de la tresorerie, pas une depense. */
  cautionTotale: number;
  parCategorie: { categorie: CategorieArticle; libelle: string; montant: number }[];
  /** Articles encore au statut « a prevoir » : le reste a faire. */
  aPrevoir: number;
}

export function budgetMateriel(articles: readonly Article[]): BudgetMateriel {
  const parCategorie = new Map<CategorieArticle, number>();
  let totalAchat = 0;
  let totalLocation = 0;
  let cautionTotale = 0;

  for (const article of articles) {
    const cout = coutArticle(article);
    if (article.mode === 'achat') totalAchat += cout;
    else totalLocation += cout;
    cautionTotale += Math.max(0, article.caution);
    parCategorie.set(article.categorie, (parCategorie.get(article.categorie) ?? 0) + cout);
  }

  return {
    total: totalAchat + totalLocation,
    totalAchat,
    totalLocation,
    cautionTotale,
    parCategorie: CATEGORIES_ARTICLE.filter((x) => parCategorie.has(x.id)).map((x) => ({
      categorie: x.id,
      libelle: x.libelle,
      montant: parCategorie.get(x.id) ?? 0,
    })),
    aPrevoir: articles.filter((x) => x.statut === 'a-prevoir').length,
  };
}

/** Ce qu'un participant avance en materiel, cautions comprises a part. */
export function avancesDe(articles: readonly Article[], participantId: string): number {
  return articles
    .filter((x) => x.payeParId === participantId)
    .reduce((somme, x) => somme + coutArticle(x), 0);
}
