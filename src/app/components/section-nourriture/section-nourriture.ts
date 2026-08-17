import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import {
  EMOJI_TYPE_PLAT,
  IDEES_PLATS,
  LIBELLE_TYPE_PLAT,
  MOMENTS,
  TYPES_PLAT,
  LIBELLE_PRIX,
  UNITES_INGREDIENT,
  coutDuRepas,
  repasPour,
} from '../../domain/nourriture';
import { compterParRegime, invitesAvecAllergies } from '../../domain/invites';
import { dateDuJour } from '../../domain/evenement';
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
  imports: [Modale],
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
  protected readonly libellePrix = LIBELLE_PRIX;
  protected readonly typesPlat = TYPES_PLAT;
  protected readonly libelleTypePlat = LIBELLE_TYPE_PLAT;
  protected readonly emojiTypePlat = EMOJI_TYPE_PLAT;

  /** Combien de repas le dernier chargement de menus a poses. */
  protected readonly menusCharges = signal(0);

  protected chargerMenus(): void {
    this.menusCharges.set(this.store.chargerMenusFestivial());
  }

  /** Les repas planifies, dates et tries : la liste propre de la section. */
  protected readonly repasPlanifies = computed(() => {
    const jours = Math.max(1, this.store.partage().jours);
    const format = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const rang = new Map(MOMENTS.map((x, i) => [x.id, i]));
    return this.store
      .nourriture()
      .repas.filter((x) => x.jour <= jours)
      .map((repas) => {
        const date = dateDuJour(this.store.infos().debut, repas.jour);
        return {
          repas,
          date: date ? format.format(date) : `Jour ${repas.jour}`,
          moment: MOMENTS.find((x) => x.id === repas.moment),
        };
      })
      .sort(
        (a, b) =>
          a.repas.jour - b.repas.jour ||
          (rang.get(a.repas.moment) ?? 0) - (rang.get(b.repas.moment) ?? 0),
      );
  });

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

  protected majTypePlat(repas: Repas, typePlat: string): void {
    this.store.definirRepas(repas.jour, repas.moment, { typePlat: typePlat as Repas['typePlat'] });
  }

  protected majNotes(repas: Repas, notes: string): void {
    this.store.definirRepas(repas.jour, repas.moment, { notes });
  }

  /**
   * On peut decider de sauter un repas : le brunch remplace le petit dejeuner
   * et le midi, personne ne mange le soir du depart. La case redevient vide,
   * et ne compte plus ni dans le budget ni dans les repas sans plat.
   */
  protected supprimerRepas(repas: Repas): void {
    const quoi = repas.plat.trim() || 'ce repas';
    if (confirm(`Retirer ${quoi} du planning ? La case redeviendra libre.`)) {
      this.store.supprimerRepas(repas.id);
    }
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
    champ: 'qteParPersonne' | 'prixUnitaire',
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

  // -- Grignotage : creation en modale ---------------------------------------

  protected readonly extraCreationOuvert = signal(false);
  protected readonly brouillonExtra = signal({ nom: '', quantite: 1, prixUnitaire: 0 });

  protected readonly extraInvalide = computed(() => this.brouillonExtra().nom.trim() === '');

  protected ouvrirCreationExtra(): void {
    this.brouillonExtra.set({ nom: '', quantite: 1, prixUnitaire: 0 });
    this.extraCreationOuvert.set(true);
  }

  protected majBrouillonExtra(
    patch: Partial<{ nom: string; quantite: number; prixUnitaire: number }>,
  ): void {
    this.brouillonExtra.set({ ...this.brouillonExtra(), ...patch });
  }

  protected creerExtra(): void {
    const brouillon = this.brouillonExtra();
    if (!brouillon.nom.trim()) return;
    const id = this.store.ajouterExtraNourriture();
    this.store.majExtraNourriture(id, {
      nom: brouillon.nom.trim(),
      quantite: Math.max(0, brouillon.quantite),
      prixUnitaire: Math.max(0, brouillon.prixUnitaire),
    });
    this.extraCreationOuvert.set(false);
  }
}
