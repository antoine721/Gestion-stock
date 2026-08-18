import {
  Article,
  ArticleCourse,
  CategorieCourse,
  ExtraNourriture,
  LigneAchat,
  UniteIngredient,
} from './models';
import { LigneCuisine } from './nourriture';
import { coutArticle } from './materiel-liste';
import { categorieDuProduit } from './categories-courses';
import { libelleQuantite } from './unites-achat';
import { fmtVolume } from './format';

/**
 * La liste de courses unifiee : tout ce qu'il faut acheter, d'ou que ca
 * vienne — bar, cuisine, grignotage, materiel. Chaque source garde son moteur
 * (le bar arrondit en bouteilles, la cuisine en paquets) ; ici on ne fait que
 * rassembler et cocher.
 */

export type GroupeCourses = 'bar' | 'cuisine' | 'grignotage' | 'rayon' | 'materiel';

export const GROUPES_COURSES: readonly { id: GroupeCourses; libelle: string; emoji: string }[] = [
  { id: 'bar', libelle: 'Bar & boissons', emoji: '🍹' },
  { id: 'cuisine', libelle: 'Cuisine', emoji: '🍳' },
  { id: 'grignotage', libelle: 'Grignotage & divers', emoji: '🥨' },
  { id: 'rayon', libelle: 'Le rayon', emoji: '🛒' },
  { id: 'materiel', libelle: 'Materiel a acheter', emoji: '🛠️' },
];

export interface LigneCourses {
  /** Identifiant stable, prefixe par le groupe : c'est lui qu'on coche. */
  id: string;
  groupe: GroupeCourses;
  /** Le rayon, qui donne sa couleur a la ligne et sa part au camembert. */
  categorie: CategorieCourse;
  nom: string;
  /** « 3 × 75 cl », « 2 kg », « 15 piece(s) »... */
  quantite: string;
  /** D'ou vient le besoin : boissons servies, plats, notes. */
  detail: string;
  prix: number;
  cochee: boolean;
  /** La photo du produit, quand on en a une. */
  imageUrl: string;
}

/** Un article de rayon vierge : la seule definition des valeurs par defaut. */
export function articleCourseVierge(id: string): ArticleCourse {
  return {
    id,
    nom: '',
    marque: '',
    code: '',
    imageUrl: '',
    categorie: 'autre',
    quantite: 1,
    contenance: 0,
    unite: 'piece',
    conditionnement: '',
    prixUnitaire: 0,
    achete: false,
  };
}

/**
 * Complete un article venu de la base avec les champs apparus depuis qu'il a
 * ete pose. Un rayon rempli avant que les contenances existent doit continuer
 * de s'afficher : sans ce filet, une seule ligne ancienne fait tomber toute la
 * liste, et avec elle la page de l'evenement.
 */
export function normaliserArticleCourse(
  brut: Partial<ArticleCourse> & { id: string },
): ArticleCourse {
  return { ...articleCourseVierge(brut.id), ...brut };
}

function qte(valeur: number, unite: UniteIngredient): string {
  if (unite === 'ml') return fmtVolume(valeur);
  if (unite === 'g') return valeur >= 1000 ? `${(valeur / 1000).toFixed(1)} kg` : `${valeur} g`;
  return `${valeur} piece(s)`;
}

export function listeCoursesUnifiee(
  lignesBar: readonly LigneAchat[],
  cuisine: readonly LigneCuisine[],
  grignotage: readonly ExtraNourriture[],
  articles: readonly Article[],
  rayon: readonly ArticleCourse[],
  cochees: ReadonlySet<string>,
): LigneCourses[] {
  const lignes: LigneCourses[] = [];

  for (const ligne of lignesBar) {
    if (ligne.bouteilles <= 0) continue;
    const id = `bar:${ligne.produit.id}`;
    lignes.push({
      id,
      groupe: 'bar',
      categorie: categorieDuProduit(ligne.produit.categorie),
      nom: ligne.produit.nom,
      quantite: `${ligne.bouteilles} × ${fmtVolume(ligne.produit.contenanceMl)}`,
      detail: ligne.detail.map((x) => x.boissonNom).join(' · '),
      prix: ligne.prixTotal,
      cochee: cochees.has(id),
      imageUrl: '',
    });
  }

  for (const ligne of cuisine) {
    if (ligne.quantiteAchat <= 0 && ligne.besoin <= 0) continue;
    const id = `cuisine:${ligne.cle}`;
    lignes.push({
      id,
      groupe: 'cuisine',
      categorie: 'nourriture',
      nom: ligne.nom,
      // Ce qu'on met dans le caddie, pas le besoin theorique : « 2 kg », pas
      // « 1,4 kg ». C'est la ligne qu'on lit au magasin.
      quantite:
        ligne.quantiteAchat > 0
          ? `${ligne.quantiteAchat} ${ligne.uniteAchat}`
          : qte(ligne.besoin, ligne.unite),
      detail: ligne.plats.join(' · '),
      prix: ligne.prixTotal,
      cochee: cochees.has(id),
      imageUrl: '',
    });
  }

  for (const extra of grignotage) {
    if (extra.nom.trim().length === 0) continue;
    const id = `grignotage:${extra.id}`;
    lignes.push({
      id,
      groupe: 'grignotage',
      categorie: 'nourriture',
      nom: extra.nom,
      quantite: `× ${Math.max(0, extra.quantite)}`,
      detail: '',
      prix: Math.max(0, extra.quantite) * Math.max(0, extra.prixUnitaire),
      cochee: cochees.has(id),
      imageUrl: '',
    });
  }

  // Le rayon : ce qu'on est alle chercher soi-meme, avec sa photo et son
  // rayon choisi a la main.
  for (const article of rayon) {
    if (article.nom.trim().length === 0) continue;
    lignes.push({
      id: `rayon:${article.id}`,
      groupe: 'rayon',
      categorie: article.categorie,
      nom: article.nom,
      quantite: libelleQuantite(article.quantite, article.contenance, article.unite),
      // Le conditionnement passe avant la marque : « 12 rouleaux » dit ce
      // qu'on achete, « Lotus » dit seulement chez qui.
      detail: [article.conditionnement, article.marque].filter((x) => x.trim()).join(' · '),
      prix: Math.max(0, article.quantite) * Math.max(0, article.prixUnitaire),
      cochee: article.achete,
      imageUrl: article.imageUrl,
    });
  }

  // Le materiel a deja son statut : c'est lui qui fait foi, pas la coche.
  for (const article of articles) {
    if (article.mode !== 'achat' || article.nom.trim().length === 0) continue;
    lignes.push({
      id: `materiel:${article.id}`,
      groupe: 'materiel',
      categorie: 'materiel',
      nom: article.nom,
      quantite: `× ${Math.max(0, article.quantite)}`,
      detail: article.notes,
      prix: coutArticle(article),
      cochee: article.statut === 'achete' || article.statut === 'recupere',
      imageUrl: article.imageUrl,
    });
  }

  return lignes;
}

export interface ResumeCourses {
  total: number;
  restant: number;
  lignes: number;
  cochees: number;
}

export function resumerCourses(lignes: readonly LigneCourses[]): ResumeCourses {
  const cochees = lignes.filter((x) => x.cochee);
  return {
    total: lignes.reduce((somme, x) => somme + x.prix, 0),
    restant: lignes.filter((x) => !x.cochee).reduce((somme, x) => somme + x.prix, 0),
    lignes: lignes.length,
    cochees: cochees.length,
  };
}
