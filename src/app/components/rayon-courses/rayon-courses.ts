import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Api, ProduitTrouve } from '../../state/api';
import { Modale } from '../modale/modale';
import { CATEGORIES_COURSE } from '../../domain/categories-courses';
import {
  UNITES_ACHAT,
  libelleQuantite,
  lireConditionnement,
  totalContenance,
} from '../../domain/unites-achat';
import { fmtEuro } from '../../domain/format';
import { ArticleCourse, CategorieCourse, UniteAchat } from '../../domain/models';

/** Ce qu'on regle avant de poser un produit dans la liste. */
interface Brouillon {
  nom: string;
  marque: string;
  code: string;
  imageUrl: string;
  categorie: CategorieCourse;
  quantite: number;
  contenance: number;
  unite: UniteAchat;
  prixUnitaire: number;
}

/** Le temps qu'on laisse a la frappe avant d'interroger Open Food Facts. */
const DELAI_FRAPPE = 280;

/**
 * Le rayon : on cherche un produit, on le pose dans la liste de courses.
 *
 * La recherche vient d'Open Food Facts et ne donne que l'identite du produit —
 * son nom, sa marque, sa photo. La quantite et le prix restent saisis a la
 * main : ils dependent du magasin et du nombre d'invites, et un prix devine
 * serait pire que pas de prix du tout.
 *
 * Rien n'oblige a passer par la recherche : le meme formulaire accepte un
 * produit tape a la main, pour ce qu'aucune base ne connait.
 */
@Component({
  selector: 'app-rayon-courses',
  imports: [Modale],
  templateUrl: './rayon-courses.html',
  styleUrl: './rayon-courses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RayonCourses {
  protected readonly store = inject(PlannerStore);
  private readonly api = inject(Api);

  protected readonly fmtEuro = fmtEuro;
  protected readonly categories = CATEGORIES_COURSE;
  protected readonly unites = UNITES_ACHAT;
  protected readonly libelleQuantite = libelleQuantite;
  protected readonly totalContenance = totalContenance;

  // -- La recherche ----------------------------------------------------------

  protected readonly requete = signal('');
  protected readonly resultats = signal<readonly ProduitTrouve[]>([]);
  protected readonly recherche = signal(false);
  protected readonly erreur = signal('');

  private minuteur?: ReturnType<typeof setTimeout>;
  /** La requete en vol, annulee des que la suivante part. */
  private enVol?: AbortController;

  protected majRequete(valeur: string): void {
    this.requete.set(valeur);
    this.erreur.set('');
    if (this.minuteur) clearTimeout(this.minuteur);

    if (valeur.trim().length < 2) {
      this.enVol?.abort();
      this.resultats.set([]);
      this.recherche.set(false);
      return;
    }

    // On attend une pause dans la frappe : une requete par lettre epuiserait
    // le debit autorise par Open Food Facts en trois mots.
    this.recherche.set(true);
    this.minuteur = setTimeout(() => void this.lancer(valeur.trim()), DELAI_FRAPPE);
  }

  private async lancer(requete: string): Promise<void> {
    this.enVol?.abort();
    const controleur = new AbortController();
    this.enVol = controleur;
    try {
      const resultats = await this.api.rechercherProduits(requete, controleur.signal);
      // Une reponse qui arrive apres que l'utilisateur a retape n'a plus rien
      // a dire : elle ne doit pas ecraser la liste affichee.
      if (controleur.signal.aborted) return;
      this.resultats.set(resultats);
      this.erreur.set(resultats.length === 0 ? 'Aucun produit trouve.' : '');
    } catch (erreur) {
      if (controleur.signal.aborted) return;
      this.resultats.set([]);
      this.erreur.set(
        erreur instanceof Error ? erreur.message : 'Recherche indisponible pour le moment.',
      );
    } finally {
      if (!controleur.signal.aborted) this.recherche.set(false);
    }
  }

  protected viderRecherche(): void {
    if (this.minuteur) clearTimeout(this.minuteur);
    this.enVol?.abort();
    this.requete.set('');
    this.resultats.set([]);
    this.erreur.set('');
    this.recherche.set(false);
  }

  // -- Poser un produit dans la liste ---------------------------------------

  protected readonly ajoutOuvert = signal(false);
  protected readonly brouillon = signal<Brouillon>(brouillonVierge());

  protected readonly ajoutInvalide = computed(() => this.brouillon().nom.trim() === '');

  /** Un resultat de recherche : nom, marque et photo sont deja remplis. */
  protected ouvrirAjout(produit: ProduitTrouve): void {
    // Le conditionnement de l'etiquette pre-remplit le contenant : « 1,5 L »
    // devient une contenance et son unite, prets a corriger si besoin.
    const { contenance, unite } = lireConditionnement(produit.conditionnement);
    this.brouillon.set({
      ...brouillonVierge(),
      nom: produit.nom,
      marque: produit.marque,
      code: produit.code,
      imageUrl: produit.imageUrl,
      contenance,
      unite,
    });
    this.ajoutOuvert.set(true);
  }

  /** Rien ne trouve, ou produit inconnu des bases : on le tape a la main. */
  protected ouvrirAjoutLibre(): void {
    this.brouillon.set({ ...brouillonVierge(), nom: this.requete().trim() });
    this.ajoutOuvert.set(true);
  }

  protected majBrouillon(patch: Partial<Brouillon>): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected majNombre(champ: 'quantite' | 'prixUnitaire' | 'contenance', valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.majBrouillon({ [champ]: Math.max(0, nombre) });
  }

  /** Repasser « a la piece » efface la contenance : elle n'aurait plus de sens. */
  protected majUnite(unite: UniteAchat): void {
    this.majBrouillon({ unite, contenance: unite === 'piece' ? 0 : this.brouillon().contenance });
  }

  protected readonly totalBrouillon = computed(
    () => this.brouillon().quantite * this.brouillon().prixUnitaire,
  );

  protected poser(): void {
    const brouillon = this.brouillon();
    if (!brouillon.nom.trim()) return;
    this.store.ajouterCourseLibre({
      nom: brouillon.nom.trim(),
      marque: brouillon.marque.trim(),
      code: brouillon.code,
      imageUrl: brouillon.imageUrl,
      categorie: brouillon.categorie,
      quantite: Math.max(1, Math.round(brouillon.quantite)),
      contenance: brouillon.unite === 'piece' ? 0 : Math.max(0, brouillon.contenance),
      unite: brouillon.unite,
      prixUnitaire: Math.max(0, brouillon.prixUnitaire),
    });
    this.ajoutOuvert.set(false);
    // La recherche se vide : on enchaine sur le produit suivant, c'est le
    // rythme des courses.
    this.viderRecherche();
  }

  // -- Ce qui est deja dans le rayon ----------------------------------------

  protected majArticle(article: ArticleCourse, patch: Partial<Omit<ArticleCourse, 'id'>>): void {
    this.store.majCourseLibre(article.id, patch);
  }

  protected majQuantite(article: ArticleCourse, delta: number): void {
    const quantite = Math.max(1, Math.round(article.quantite + delta));
    this.store.majCourseLibre(article.id, { quantite });
  }

  protected majArticleNombre(
    article: ArticleCourse,
    champ: 'quantite' | 'prixUnitaire' | 'contenance',
    valeur: string,
  ): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.majArticle(article, { [champ]: Math.max(0, nombre) });
  }

  protected supprimer(article: ArticleCourse): void {
    this.store.supprimerCourseLibre(article.id);
  }

  protected readonly totalRayon = computed(() =>
    this.store.coursesLibres().reduce((somme, x) => somme + x.quantite * x.prixUnitaire, 0),
  );

  protected teinteDe(categorie: CategorieCourse): string {
    return CATEGORIES_COURSE.find((x) => x.id === categorie)?.teinte ?? 'neutre';
  }
}

function brouillonVierge(): Brouillon {
  return {
    nom: '',
    marque: '',
    code: '',
    imageUrl: '',
    categorie: 'intendance',
    quantite: 1,
    contenance: 0,
    unite: 'piece',
    prixUnitaire: 0,
  };
}
