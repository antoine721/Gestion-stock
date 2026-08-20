import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Tarifs } from '../tarifs/tarifs';
import { fmtEntier, fmtEuro, fmtNombre, fmtVolume } from '../../domain/format';

/**
 * La vue d'ensemble chiffree : le budget global par poste, et qui paye quoi.
 * C'est la page qu'on ouvre pour repondre a « ca nous coute combien, et qui
 * doit combien ? ». Ce qui reste a faire vit dans l'accueil, ou chaque piece
 * porte deja son propre compteur.
 */
@Component({
  selector: 'app-section-stats',
  imports: [Tarifs],
  templateUrl: './section-stats.html',
  styleUrl: './section-stats.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionStats {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;
  protected readonly fmtVolume = fmtVolume;

  /** Seuls les postes non vides occupent la barre de composition. */
  protected readonly postes = computed(() =>
    this.store.budgetGlobal().postes.filter((x) => x.montant > 0),
  );

  protected readonly partMax = computed(() =>
    this.store.repartitionGlobale().reduce((max, x) => Math.max(max, x.part), 0),
  );

  protected readonly avancesPresentes = computed(() =>
    this.store.repartitionGlobale().some((x) => x.avance > 0),
  );
}
