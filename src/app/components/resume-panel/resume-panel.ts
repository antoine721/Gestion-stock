import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { fmtEntier, fmtEuro } from '../../domain/format';

/**
 * Le compagnon de l'onglet d'un co-organisateur : ce que sa saisie represente,
 * et ou en est l'evenement, sans quitter la page.
 */
@Component({
  selector: 'app-resume-panel',
  templateUrl: './resume-panel.html',
  styleUrl: './resume-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumePanel {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;

  protected readonly maPart = computed(() => {
    const participant = this.store.participantEdite();
    return this.store.repartition().find((x) => x.participantId === participant?.id);
  });
}
