import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LIBELLE_GROUPE, ORDRE_GROUPE } from '../../domain/validation';
import { fmtEcart, fmtNombre } from '../../domain/format';
import { EtatRatio, GroupeRatio, Ratio } from '../../domain/models';

interface BlocRatios {
  groupe: GroupeRatio;
  libelle: string;
  ratios: Ratio[];
}

/** US6 - Ma prediction tient-elle debout ? Avertit, ne bloque jamais. */
@Component({
  selector: 'app-validation-panel',
  templateUrl: './validation-panel.html',
  styleUrl: './validation-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationPanel {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtNombre = fmtNombre;
  protected readonly fmtEcart = fmtEcart;

  protected readonly blocs = computed<BlocRatios[]>(() => {
    const ratios = this.store.ratios();
    return ORDRE_GROUPE.map((groupe) => ({
      groupe,
      libelle: LIBELLE_GROUPE[groupe],
      ratios: ratios.filter((x) => x.groupe === groupe),
    })).filter((bloc) => bloc.ratios.length > 0);
  });

  protected readonly synthese = computed(() => {
    const ratios = this.store.ratios();
    const alertes = this.store.alertes();
    const ko =
      ratios.filter((x) => x.etat === 'ko').length +
      alertes.filter((x) => x.niveau === 'ko').length;
    const warn =
      ratios.filter((x) => x.etat === 'warn').length +
      alertes.filter((x) => x.niveau === 'warn').length;

    const etat: EtatRatio = ko > 0 ? 'ko' : warn > 0 ? 'warn' : 'ok';
    const message =
      ko > 0
        ? `${ko} point(s) a corriger`
        : warn > 0
          ? `${warn} point(s) a surveiller`
          : 'Prediction coherente avec ton cadre';
    return { etat, message };
  });
}
