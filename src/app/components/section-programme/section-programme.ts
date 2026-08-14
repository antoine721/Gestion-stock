import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { DemandeMusicale, TYPES_CRENEAU, planningDuJour } from '../../domain/programme';
import { fmtEntier } from '../../domain/format';
import { Creneau, Morceau } from '../../domain/models';

/**
 * Le programme du festival : le planning jour par jour — ce qui a ete mis en
 * place, quand, qui s'en occupe — et le coin DJ : la tracklist commune,
 * alimentee a la main ou depuis les demandes du formulaire, et les
 * volontaires qui ont envie de faire quelque chose.
 */
@Component({
  selector: 'app-section-programme',
  templateUrl: './section-programme.html',
  styleUrl: './section-programme.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionProgramme {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly types = TYPES_CRENEAU;

  protected readonly journees = computed(() => {
    const programme = this.store.programme();
    const jours = Math.max(1, this.store.partage().jours);
    return Array.from({ length: jours }, (_, i) => ({
      jour: i + 1,
      creneaux: planningDuJour(programme, i + 1),
    }));
  });

  protected maj(creneau: Creneau, patch: Partial<Omit<Creneau, 'id'>>): void {
    this.store.majCreneau(creneau.id, patch);
  }

  protected supprimerCreneau(creneau: Creneau): void {
    if (confirm(`Retirer « ${creneau.titre || 'ce creneau'} » du planning ?`)) {
      this.store.supprimerCreneau(creneau.id);
    }
  }

  protected majMorceau(morceau: Morceau, patch: Partial<Omit<Morceau, 'id'>>): void {
    this.store.majMorceau(morceau.id, patch);
  }

  /** Une demande du formulaire devient une ligne de tracklist, d'un clic. */
  protected ajouterDemande(demande: DemandeMusicale): void {
    this.store.ajouterMorceau({ titre: demande.texte, demandePar: demande.demandePar });
  }
}
