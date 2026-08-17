import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { TYPES_CRENEAU, nomDeRef, planningDuJour } from '../../domain/programme';
import { dateDuJour } from '../../domain/evenement';
import { fmtEntier } from '../../domain/format';
import { Creneau, TypeCreneau } from '../../domain/models';

/**
 * Le programme du festival, en calendrier : une colonne par jour, les
 * creneaux-missions en ordre chronologique. Tout le monde participe — chaque
 * creneau porte ses assignes, visibles d'un coup d'oeil, et l'edition s'ouvre
 * au clic sur la carte.
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

  /** Le creneau ouvert en edition, un seul a la fois. */
  protected readonly ouvert = signal('');

  protected readonly journees = computed(() => {
    const programme = this.store.programme();
    const jours = Math.max(1, this.store.partage().jours);
    // Avec une date de debut posee au profil, chaque colonne porte sa vraie date.
    const format = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return Array.from({ length: jours }, (_, i) => {
      const date = dateDuJour(this.store.infos().debut, i + 1);
      return {
        jour: i + 1,
        date: date ? format.format(date) : '',
        creneaux: planningDuJour(programme, i + 1),
      };
    });
  });

  protected emojiDe(type: TypeCreneau): string {
    return TYPES_CRENEAU.find((x) => x.id === type)?.emoji ?? '📌';
  }

  protected nomDe(ref: string): string {
    return nomDeRef(ref, this.store.participants(), this.store.invitesNommes());
  }

  protected basculer(creneauId: string): void {
    this.ouvert.set(this.ouvert() === creneauId ? '' : creneauId);
  }

  protected ajouter(jour: number): void {
    // Un creneau neuf s'ouvre en edition : il y a tout a remplir.
    this.ouvert.set(this.store.ajouterCreneau(jour));
  }

  protected maj(creneau: Creneau, patch: Partial<Omit<Creneau, 'id'>>): void {
    this.store.majCreneau(creneau.id, patch);
  }

  protected assigner(creneau: Creneau, evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    if (select.value) this.store.assignerPersonne(creneau.id, select.value);
    select.value = '';
  }

  protected supprimer(creneau: Creneau): void {
    if (confirm(`Retirer « ${creneau.titre || 'ce creneau'} » du planning ?`)) {
      this.store.supprimerCreneau(creneau.id);
    }
  }
}
