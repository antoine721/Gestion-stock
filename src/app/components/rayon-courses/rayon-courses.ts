import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Catalogue } from '../../state/catalogue';
import { Modale } from '../modale/modale';
import { CATEGORIES_COURSE } from '../../domain/categories-courses';
import {
  UNITES_ACHAT,
  formatContenance,
  libelleQuantite,
  totalContenance,
} from '../../domain/unites-achat';
import { ProduitCatalogue } from '../../domain/catalogue-produits';
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
  conditionnement: string;
  prixUnitaire: number;
}

/** En dessous de deux lettres, la recherche renverrait la moitie du rayon. */
const MINIMUM_FRAPPE = 2;

/**
 * Le rayon : on cherche un produit, on le pose dans la liste de courses.
 *
 * La recherche tape dans un catalogue local — un releve de rayon traduit et
 * resserre sur ce qui sert a un festival. Elle repond a la frappe, sans
 * reseau : c'est ce qui permet de s'en servir dans un magasin ou le telephone
 * ne capte pas.
 *
 * Le prix du catalogue pre-remplit le formulaire, la quantite reste a saisir.
 * Les deux se corrigent : c'est le ticket de caisse qui a le dernier mot.
 *
 * Rien n'oblige a passer par la recherche : le meme formulaire accepte un
 * produit tape a la main, pour ce que le catalogue ne connait pas.
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
  protected readonly catalogue = inject(Catalogue);

  protected readonly fmtEuro = fmtEuro;
  protected readonly categories = CATEGORIES_COURSE;
  protected readonly unites = UNITES_ACHAT;
  protected readonly libelleQuantite = libelleQuantite;
  protected readonly totalContenance = totalContenance;

  constructor() {
    // Le catalogue arrive en une fois, au premier affichage du rayon.
    void this.catalogue.charger();
  }

  // -- La recherche ----------------------------------------------------------

  /** Le produit dont la carte est ouverte : survol a la souris, focus au clavier. */
  protected readonly survole = signal('');

  protected readonly requete = signal('');

  protected readonly resultats = computed(() =>
    this.requete().trim().length < MINIMUM_FRAPPE ? [] : this.catalogue.chercher(this.requete()),
  );

  protected readonly sansResultat = computed(
    () => this.requete().trim().length >= MINIMUM_FRAPPE && this.resultats().length === 0,
  );

  protected majRequete(valeur: string): void {
    this.requete.set(valeur);
  }

  protected viderRecherche(): void {
    this.requete.set('');
  }

  /**
   * Les photos sont hebergees chez l'enseigne : certaines disparaissent, et
   * une image cassee est plus laide que pas d'image du tout. On retient
   * celles qui ont echoue et on retombe sur l'icone.
   */
  private readonly imagesCassees = signal<ReadonlySet<string>>(new Set());

  /**
   * L'etiquette d'une vignette : ce qu'il y a dedans et sous quelle forme —
   * « 330 ml · canette », « 12 rouleaux ». C'est la reponse a « combien j'en
   * ai pour un » sans avoir a ouvrir la fiche.
   */
  protected etiquette(produit: ProduitCatalogue): string {
    return [formatContenance(produit.contenance, produit.unite), produit.conditionnement]
      .filter((x) => x !== '')
      .join(' · ');
  }

  protected imageVisible(cle: string, imageUrl: string): boolean {
    return imageUrl !== '' && !this.imagesCassees().has(cle);
  }

  protected signalerImageCassee(cle: string): void {
    this.imagesCassees.set(new Set(this.imagesCassees()).add(cle));
  }

  // -- Poser un produit dans la liste ---------------------------------------

  protected readonly ajoutOuvert = signal(false);
  protected readonly brouillon = signal<Brouillon>(brouillonVierge());

  protected readonly ajoutInvalide = computed(() => this.brouillon().nom.trim() === '');

  /** Un produit du catalogue : tout est deja rempli, il reste la quantite. */
  protected ouvrirAjout(produit: ProduitCatalogue): void {
    this.brouillon.set({
      ...brouillonVierge(),
      nom: produit.nom,
      marque: produit.marque,
      code: produit.code,
      imageUrl: produit.imageUrl,
      categorie: produit.categorie,
      contenance: produit.contenance,
      unite: produit.unite,
      conditionnement: produit.conditionnement,
      prixUnitaire: produit.prix,
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
      conditionnement: brouillon.conditionnement.trim(),
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
    conditionnement: '',
    prixUnitaire: 0,
  };
}
