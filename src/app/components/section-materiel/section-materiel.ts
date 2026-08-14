import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import {
  CATEGORIES_ARTICLE,
  IDEES_ARTICLES,
  MODES_ARTICLE,
  STATUTS_ARTICLE,
  coutArticle,
} from '../../domain/materiel-liste';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { Article } from '../../domain/models';

/**
 * Le materiel : tout ce qui coute sans se boire ni se manger. Un tableau
 * unique achat + location, parce que la vraie question n'est pas « loue ou
 * achete ? » mais « qui s'en occupe et combien ca coute ? ».
 */
@Component({
  selector: 'app-section-materiel',
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

  protected ajouterIdee(evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    const idee = IDEES_ARTICLES.find((x) => x.nom === select.value);
    if (idee)
      this.store.ajouterArticle({ nom: idee.nom, categorie: idee.categorie, mode: idee.mode });
    select.value = '';
  }

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
    }
  }
}
