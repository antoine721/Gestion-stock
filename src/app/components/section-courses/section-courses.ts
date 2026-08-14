import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { GROUPES_COURSES, LigneCourses } from '../../domain/courses';
import { fmtEntier, fmtEuro } from '../../domain/format';

interface GroupeAffiche {
  id: string;
  libelle: string;
  emoji: string;
  lignes: LigneCourses[];
  total: number;
}

/**
 * La liste de courses unifiee : tout ce qu'il faut acheter, d'ou que ca
 * vienne. Chaque moteur (bar, cuisine) a deja fait ses arrondis ; ici on
 * pousse le caddie et on coche.
 */
@Component({
  selector: 'app-section-courses',
  templateUrl: './section-courses.html',
  styleUrl: './section-courses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionCourses {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;

  protected readonly groupes = computed<GroupeAffiche[]>(() => {
    const lignes = this.store.listeCourses();
    return GROUPES_COURSES.map((groupe) => {
      const siennes = lignes.filter((x) => x.groupe === groupe.id);
      return {
        id: groupe.id,
        libelle: groupe.libelle,
        emoji: groupe.emoji,
        lignes: siennes,
        total: siennes.reduce((somme, x) => somme + x.prix, 0),
      };
    }).filter((x) => x.lignes.length > 0);
  });
}
