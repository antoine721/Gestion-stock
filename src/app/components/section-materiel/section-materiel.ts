import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import {
  CATEGORIES_ARTICLE,
  IDEES_ARTICLES,
  MODES_ARTICLE,
  STATUTS_ARTICLE,
  coutArticle,
} from '../../domain/materiel-liste';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { Article, CategorieArticle, ModeArticle } from '../../domain/models';

/** La saisie minimale d'un nouvel article. */
interface BrouillonArticle {
  nom: string;
  categorie: CategorieArticle;
  mode: ModeArticle;
  quantite: number;
  prixUnitaire: number;
}

/**
 * Le materiel : tout ce qui coute sans se boire ni se manger. Un tableau
 * unique achat + location, parce que la vraie question n'est pas « loue ou
 * achete ? » mais « qui s'en occupe et combien ca coute ? ». La creation
 * passe par une modale, le detail par le panneau lateral.
 */
@Component({
  selector: 'app-section-materiel',
  imports: [Modale, Panneau],
  templateUrl: './section-materiel.html',
  styleUrl: './section-materiel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionMateriel {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly coutArticle = coutArticle;
  protected readonly categories = CATEGORIES_ARTICLE;
  protected readonly modes = MODES_ARTICLE;
  protected readonly statuts = STATUTS_ARTICLE;

  /** Les idees pas encore dans la liste, pour ne proposer que du nouveau. */
  protected readonly idees = computed(() => {
    const dejaLa = new Set(this.store.articles().map((x) => x.nom.toLowerCase()));
    return IDEES_ARTICLES.filter((x) => !dejaLa.has(x.nom.toLowerCase()));
  });

  protected libelleCategorie(id: string): string {
    const categorie = CATEGORIES_ARTICLE.find((x) => x.id === id);
    return categorie ? `${categorie.emoji} ${categorie.libelle}` : '';
  }

  protected libelleStatut(id: string): string {
    return STATUTS_ARTICLE.find((x) => x.id === id)?.libelle ?? '';
  }

  protected libelleMode(id: string): string {
    return MODES_ARTICLE.find((x) => x.id === id)?.libelle ?? '';
  }

  /** Achete ou recupere : l'article ne demande plus rien. */
  protected estFait(article: Article): boolean {
    return article.statut === 'achete' || article.statut === 'recupere';
  }

  // -- Creation --------------------------------------------------------------

  protected readonly creationOuverte = signal(false);
  protected readonly brouillon = signal<BrouillonArticle>({
    nom: '',
    categorie: 'autre',
    mode: 'achat',
    quantite: 1,
    prixUnitaire: 0,
  });

  protected readonly creationInvalide = computed(() => this.brouillon().nom.trim() === '');

  protected ouvrirCreation(): void {
    this.brouillon.set({
      nom: '',
      categorie: 'autre',
      mode: 'achat',
      quantite: 1,
      prixUnitaire: 0,
    });
    this.creationOuverte.set(true);
  }

  protected majBrouillon(patch: Partial<BrouillonArticle>): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected creer(): void {
    const brouillon = this.brouillon();
    if (!brouillon.nom.trim()) return;
    const id = this.store.ajouterArticle({
      nom: brouillon.nom.trim(),
      categorie: brouillon.categorie,
      mode: brouillon.mode,
      quantite: Math.max(1, brouillon.quantite),
      prixUnitaire: Math.max(0, brouillon.prixUnitaire),
    });
    this.creationOuverte.set(false);
    this.detailId.set(id);
  }

  /** Une idee du catalogue arrive pre-remplie dans la modale de creation. */
  protected piocherIdee(evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    const idee = IDEES_ARTICLES.find((x) => x.nom === select.value);
    select.value = '';
    if (!idee) return;
    this.brouillon.set({
      nom: idee.nom,
      categorie: idee.categorie,
      mode: idee.mode,
      quantite: 1,
      prixUnitaire: 0,
    });
    this.creationOuverte.set(true);
  }

  // -- Detail ----------------------------------------------------------------

  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.store.articles().find((x) => x.id === this.detailId()),
  );

  protected maj(article: Article, patch: Partial<Omit<Article, 'id'>>): void {
    this.store.majArticle(article.id, patch);
  }

  protected majNombre(
    article: Article,
    champ: 'quantite' | 'prixUnitaire' | 'caution',
    valeur: string,
  ): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre))
      this.store.majArticle(article.id, { [champ]: Math.max(0, nombre) });
  }

  protected supprimer(article: Article): void {
    if (confirm(`Retirer « ${article.nom || 'cet article'} » de la liste ?`)) {
      this.store.supprimerArticle(article.id);
      if (this.detailId() === article.id) this.detailId.set('');
    }
  }
}
