import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import {
  EMOJI_TYPE_PLAT,
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

/** Ce qu'une case sait dire d'elle-meme sans qu'on l'ouvre. */
type EtatCase = 'vide' | 'a-decider' | 'prevu' | 'saute';

interface CaseRepas {
  moment: (typeof MOMENTS)[number];
  repas: Repas | undefined;
  etat: EtatCase;
  cout: number;
  /** Les puces de resume : type de plat, convives, vegetarien, ingredients. */
  puces: string[];
}

interface LigneJour {
  jour: number;
  date: string;
  cout: number;
  cases: CaseRepas[];
}

/**
 * La nourriture se planifie comme le bar se calcule : par personne et par
 * repas. La grille jour x moment rend les trous visibles — un repas sans plat
 * est un probleme qu'on voit avant d'avoir trente affames sur les bras.
 *
 * Une case ne montre que son etat : ce qu'on mange, ce que ca coute, et les
 * puces qui resument le reste. Toute la saisie — plat, ingredients, convives,
 * notes — vit dans le panneau lateral, comme partout ailleurs dans l'app.
 * Avant, chaque case portait son formulaire ouvert : trois jours de festival
 * faisaient neuf formulaires empiles a l'ecran.
 */
@Component({
  selector: 'app-section-nourriture',
  imports: [Modale, Panneau],
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

  /** La selection ouverte dans le panneau lateral. */
  protected readonly selection = signal<{ jour: number; moment: MomentRepas } | undefined>(
    undefined,
  );

  protected readonly repasOuvert = computed(() => {
    const choix = this.selection();
    if (!choix) return undefined;
    const repas = repasPour(this.store.nourriture(), choix.jour, choix.moment);
    return repas ? { repas, moment: MOMENTS.find((x) => x.id === choix.moment) } : undefined;
  });

  /**
   * La grille jour x moment. Chaque case porte deja son etat et son resume :
   * le gabarit n'a plus qu'a l'afficher, il ne recalcule rien.
   */
  protected readonly grille = computed<LigneJour[]>(() => {
    const nourriture = this.store.nourriture();
    const invites = this.store.cadre().invites;
    const jours = Math.max(1, this.store.partage().jours);
    const format = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return Array.from({ length: jours }, (_, i) => {
      const jour = i + 1;
      const date = dateDuJour(this.store.infos().debut, jour);
      const cases = MOMENTS.map<CaseRepas>((moment) => {
        const repas = repasPour(nourriture, jour, moment.id);
        return {
          moment,
          repas,
          etat: etatDe(repas),
          cout: repas && !repas.sansRepas ? coutDuRepas(repas, invites) : 0,
          puces: repas ? pucesDe(repas) : [],
        };
      });
      return {
        jour,
        date: date ? format.format(date) : `Jour ${jour}`,
        cout: cases.reduce((somme, x) => somme + x.cout, 0),
        cases,
      };
    });
  });

  /** La ligne de tete : ou en est le remplissage, et ce que ca coute. */
  protected readonly resume = computed(() => {
    const budget = this.store.budgetNourriture();
    const cases = this.grille().flatMap((x) => x.cases);
    const prevus = cases.filter((x) => x.etat === 'prevu').length;
    const aDecider = cases.filter((x) => x.etat === 'vide' || x.etat === 'a-decider').length;
    const decides = prevus + cases.filter((x) => x.etat === 'saute').length;
    return {
      total: budget.total,
      coutRepas: budget.coutRepas,
      prevus,
      aDecider,
      sautes: cases.filter((x) => x.etat === 'saute').length,
      // Le pourcentage de cases tranchees : un repas saute est une decision.
      avancement: cases.length === 0 ? 0 : Math.round((decides / cases.length) * 100),
    };
  });

  protected ouvrir(jour: number, moment: MomentRepas): void {
    this.selection.set({ jour, moment });
  }

  /** Une case vide qu'on ouvre est une case qu'on veut remplir : on la cree. */
  protected prevoir(jour: number, moment: MomentRepas): void {
    this.store.definirRepas(jour, moment, {});
    this.selection.set({ jour, moment });
  }

  protected readonly regimes = computed(() => compterParRegime(this.store.invitesNommes()));

  protected readonly allergies = computed(() => invitesAvecAllergies(this.store.invitesNommes()));

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
   * On peut decider de ne pas faire un repas : le brunch remplace le petit
   * dejeuner et le midi, personne ne mange le soir du depart. La decision est
   * gardee — la case sort du budget ET des repas a decider, au lieu de
   * repasser en « a decider » a la seconde ou on l'a videe.
   */
  protected sauterRepas(repas: Repas): void {
    const quoi = repas.plat.trim() || 'ce repas';
    if (confirm(`On ne fait pas ${quoi} ? La case ne comptera plus dans les repas a decider.`)) {
      this.store.sauterRepas(repas.jour, repas.moment);
      this.selection.set(undefined);
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

function etatDe(repas: Repas | undefined): EtatCase {
  if (!repas) return 'vide';
  if (repas.sansRepas) return 'saute';
  return repas.plat.trim() ? 'prevu' : 'a-decider';
}

/** Ce qu'on lit sur la case sans l'ouvrir : la forme, qui mange, les options. */
function pucesDe(repas: Repas): string[] {
  const puces: string[] = [];
  if (repas.typePlat && repas.typePlat !== 'a-definir') {
    puces.push(`${EMOJI_TYPE_PLAT[repas.typePlat]} ${LIBELLE_TYPE_PLAT[repas.typePlat]}`);
  }
  if (repas.convives > 0) puces.push(`${repas.convives} convives`);
  if (repas.vegetarienPrevu) puces.push('🌱 vege');
  if (repas.ingredients.length > 0) puces.push(`${repas.ingredients.length} ingredient(s)`);
  if (repas.notes.trim()) puces.push('📝');
  return puces;
}
