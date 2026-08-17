import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { dureeEnJours, joursAvant } from '../../domain/evenement';
import { fmtEntier, fmtEuro } from '../../domain/format';

/**
 * La carte d'identite de l'evenement : son nom, ou et quand il se passe, et
 * les reperes chiffres qu'on veut garder sous les yeux. C'est ici qu'on
 * renomme l'evenement et qu'on cale les dates — le compte a rebours et le
 * planning s'en servent ensuite.
 */
@Component({
  selector: 'app-section-profil',
  templateUrl: './section-profil.html',
  styleUrl: './section-profil.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionProfil {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;

  protected readonly compteARebours = computed(() =>
    joursAvant(this.store.infos().debut, new Date()),
  );

  /** « J-12 », « C'est aujourd'hui », « En cours »… selon ou on en est. */
  protected readonly libelleCompte = computed(() => {
    const avant = this.compteARebours();
    if (avant === null) return '';
    if (avant > 0) return `J-${avant}`;
    if (avant === 0) return "C'est aujourd'hui !";
    const apresFin = joursAvant(this.store.infos().fin, new Date());
    return apresFin !== null && apresFin < 0 ? 'Termine' : 'En cours';
  });

  protected readonly duree = computed(() =>
    dureeEnJours(this.store.infos().debut, this.store.infos().fin),
  );

  /** Les dates disent une duree, le calcul en utilise une autre : a signaler. */
  protected readonly dureeDecalee = computed(() => {
    const duree = this.duree();
    return duree !== null && duree !== this.store.partage().jours;
  });

  protected calerDuree(): void {
    const duree = this.duree();
    if (duree !== null) this.store.majCadre({ jours: duree });
  }
}
