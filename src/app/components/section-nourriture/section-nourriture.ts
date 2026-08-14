import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import {
  IDEES_PLATS,
  MOMENTS,
  UNITES_INGREDIENT,
  coutDuRepas,
  repasPour,
} from '../../domain/nourriture';
import { compterParRegime, invitesAvecAllergies } from '../../domain/invites';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { IngredientRepas, MomentRepas, Repas } from '../../domain/models';

interface CaseRepas {
  moment: (typeof MOMENTS)[number];
  repas: Repas | undefined;
}

/**
 * La nourriture se planifie comme le bar se calcule : par personne et par
 * repas. La grille jour x moment rend les trous visibles — un repas sans plat
 * est un probleme qu'on voit avant d'avoir trente affames sur les bras.
 */
@Component({
  selector: 'app-section-nourriture',
  templateUrl: './section-nourriture.html',
  styleUrl: './section-nourriture.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionNourriture {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly coutDuRepas = coutDuRepas;
  protected readonly unites = UNITES_INGREDIENT;

  protected readonly grille = computed(() => {
    const nourriture = this.store.nourriture();
    const jours = Math.max(1, this.store.partage().jours);
    return Array.from({ length: jours }, (_, i) => ({
      jour: i + 1,
      cases: MOMENTS.map<CaseRepas>((moment) => ({
        moment,
        repas: repasPour(nourriture, i + 1, moment.id),
      })),
    }));
  });

  protected readonly regimes = computed(() => compterParRegime(this.store.invitesNommes()));

  protected readonly allergies = computed(() => invitesAvecAllergies(this.store.invitesNommes()));

  protected ideesPour(moment: MomentRepas) {
    return IDEES_PLATS.filter((x) => x.moments.includes(moment));
  }

  /** Une idee du catalogue pre-remplit le plat ET ses ingredients doses. */
  protected choisirIdee(jour: number, moment: MomentRepas, evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    if (select.value) this.store.appliquerIdee(jour, moment, select.value);
    select.value = '';
  }

  protected platLibre(jour: number, moment: MomentRepas): void {
    this.store.definirRepas(jour, moment, {});
  }

  protected majPlat(repas: Repas, plat: string): void {
    this.store.definirRepas(repas.jour, repas.moment, { plat });
  }

  protected majCout(repas: Repas, valeur: string): void {
    const cout = Number(valeur);
    if (Number.isFinite(cout)) {
      this.store.definirRepas(repas.jour, repas.moment, { coutParPersonne: Math.max(0, cout) });
    }
  }

  protected majConvives(repas: Repas, valeur: string): void {
    const convives = Number(valeur);
    if (Number.isFinite(convives)) {
      this.store.definirRepas(repas.jour, repas.moment, {
        convives: Math.max(0, Math.round(convives)),
      });
    }
  }

  protected basculerVegetarien(repas: Repas): void {
    this.store.definirRepas(repas.jour, repas.moment, {
      vegetarienPrevu: !repas.vegetarienPrevu,
    });
  }

  protected majNotes(repas: Repas, notes: string): void {
    this.store.definirRepas(repas.jour, repas.moment, { notes });
  }

  protected majIngredientTexte(
    repas: Repas,
    ingredient: IngredientRepas,
    patch: Partial<Pick<IngredientRepas, 'nom' | 'unite'>>,
  ): void {
    this.store.majIngredient(repas.id, ingredient.id, patch);
  }

  protected majIngredientNombre(
    repas: Repas,
    ingredient: IngredientRepas,
    champ: 'qteParPersonne' | 'conditionnement' | 'prixConditionnement',
    valeur: string,
  ): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) {
      this.store.majIngredient(repas.id, ingredient.id, { [champ]: Math.max(0, nombre) });
    }
  }

  protected majExtra(extraId: string, patch: { nom?: string }): void {
    this.store.majExtraNourriture(extraId, patch);
  }

  protected majExtraNombre(
    extraId: string,
    champ: 'quantite' | 'prixUnitaire',
    valeur: string,
  ): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) {
      this.store.majExtraNourriture(extraId, { [champ]: Math.max(0, nombre) });
    }
  }
}
