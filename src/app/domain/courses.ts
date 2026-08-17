import { Article, ExtraNourriture, LigneAchat, UniteIngredient } from './models';
import { LigneCuisine } from './nourriture';
import { coutArticle } from './materiel-liste';
import { fmtVolume } from './format';

/**
 * La liste de courses unifiee : tout ce qu'il faut acheter, d'ou que ca
 * vienne — bar, cuisine, grignotage, materiel. Chaque source garde son moteur
 * (le bar arrondit en bouteilles, la cuisine en paquets) ; ici on ne fait que
 * rassembler et cocher.
 */

export type GroupeCourses = 'bar' | 'cuisine' | 'grignotage' | 'materiel';

export const GROUPES_COURSES: readonly { id: GroupeCourses; libelle: string; emoji: string }[] = [
  { id: 'bar', libelle: 'Bar & boissons', emoji: '🍹' },
  { id: 'cuisine', libelle: 'Cuisine', emoji: '🍳' },
  { id: 'grignotage', libelle: 'Grignotage & divers', emoji: '🥨' },
  { id: 'materiel', libelle: 'Materiel a acheter', emoji: '🛠️' },
];

export interface LigneCourses {
  /** Identifiant stable, prefixe par le groupe : c'est lui qu'on coche. */
  id: string;
  groupe: GroupeCourses;
  nom: string;
  /** « 3 × 75 cl », « 2 kg », « 15 piece(s) »... */
  quantite: string;
  /** D'ou vient le besoin : boissons servies, plats, notes. */
  detail: string;
  prix: number;
  cochee: boolean;
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
  cochees: ReadonlySet<string>,
): LigneCourses[] {
  const lignes: LigneCourses[] = [];

  for (const ligne of lignesBar) {
    if (ligne.bouteilles <= 0) continue;
    const id = `bar:${ligne.produit.id}`;
    lignes.push({
      id,
      groupe: 'bar',
      nom: ligne.produit.nom,
      quantite: `${ligne.bouteilles} × ${fmtVolume(ligne.produit.contenanceMl)}`,
      detail: ligne.detail.map((x) => x.boissonNom).join(' · '),
      prix: ligne.prixTotal,
      cochee: cochees.has(id),
    });
  }

  for (const ligne of cuisine) {
    if (ligne.quantiteAchat <= 0 && ligne.besoin <= 0) continue;
    const id = `cuisine:${ligne.cle}`;
    lignes.push({
      id,
      groupe: 'cuisine',
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
    });
  }

  for (const extra of grignotage) {
    if (extra.nom.trim().length === 0) continue;
    const id = `grignotage:${extra.id}`;
    lignes.push({
      id,
      groupe: 'grignotage',
      nom: extra.nom,
      quantite: `× ${Math.max(0, extra.quantite)}`,
      detail: '',
      prix: Math.max(0, extra.quantite) * Math.max(0, extra.prixUnitaire),
      cochee: cochees.has(id),
    });
  }

  // Le materiel a deja son statut : c'est lui qui fait foi, pas la coche.
  for (const article of articles) {
    if (article.mode !== 'achat' || article.nom.trim().length === 0) continue;
    lignes.push({
      id: `materiel:${article.id}`,
      groupe: 'materiel',
      nom: article.nom,
      quantite: `× ${Math.max(0, article.quantite)}`,
      detail: article.notes,
      prix: coutArticle(article),
      cochee: article.statut === 'achete' || article.statut === 'recupere',
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
