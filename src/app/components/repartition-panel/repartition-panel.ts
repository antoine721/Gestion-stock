import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { fmtEntier, fmtEuro, fmtNombre } from '../../domain/format';

/** Qui paye quoi, au prorata de ce que ses invites consomment. */
@Component({
  selector: 'app-repartition-panel',
  templateUrl: './repartition-panel.html',
  styleUrl: './repartition-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepartitionPanel {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;
}
