import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LIBELLE_PROFIL } from '../../domain/validation';
import { Cibles, Profil } from '../../domain/models';
import { fmtNombre } from '../../domain/format';

interface ChampCible {
  champ: keyof Cibles;
  label: string;
  pas: number;
}

/** US0 - Les reglages communs a l'evenement. Ils fixent les ratios de validation. */
@Component({
  selector: 'app-reglages-form',
  templateUrl: './reglages-form.html',
  styleUrl: './reglages-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReglagesForm {
  protected readonly store = inject(PlannerStore);
  protected readonly profils: readonly Profil[] = ['soft', 'normal', 'festif'];
  protected readonly libelleProfil = LIBELLE_PROFIL;
  protected readonly ciblesOuvertes = signal(false);
  protected readonly fmtNombre = fmtNombre;

  protected readonly champs: readonly ChampCible[] = [
    { champ: 'verresParBuveurParJour', label: 'Verres / buveur / jour', pas: 0.5 },
    { champ: 'alcoolPurClParBuveurParJour', label: 'Alcool pur (cl) / buveur / jour', pas: 0.5 },
    { champ: 'softLParNonBuveurParJour', label: 'Sans alcool (L) / non-buveur / jour', pas: 0.1 },
    { champ: 'liquideLParPersonneParJour', label: 'Liquide (L) / personne / jour', pas: 0.05 },
    { champ: 'ratioDiluantSpiritueux', label: 'Diluant / alcool fort (mini)', pas: 0.5 },
    { champ: 'partDominanteMaxPct', label: 'Part boisson dominante (maxi %)', pas: 5 },
    { champ: 'restePctMax', label: 'Reste sur les bras (maxi %)', pas: 5 },
    { champ: 'referencesMax', label: 'References a acheter (maxi)', pas: 1 },
    { champ: 'budgetParPersonneParJour', label: 'Budget (€) / personne / jour', pas: 1 },
    { champ: 'partAlcoolBudgetPct', label: "Part de l'alcool dans le budget (%)", pas: 5 },
  ];

  protected majJours(valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majCadre({ jours: Math.round(nombre) });
  }

  protected majNom(valeur: string): void {
    if (valeur.trim()) this.store.majPartage({ nom: valeur.trim() });
  }

  protected majCible(champ: keyof Cibles, valeur: string): void {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre) || nombre < 0) return;
    const patch: Partial<Cibles> = { [champ]: nombre };
    this.store.majCible(patch);
  }
}
