import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { GROUPES_COURSES, LigneCourses } from '../../domain/courses';
import { CATEGORIE_COURSE_PAR_ID } from '../../domain/categories-courses';
import { CamembertCourses } from '../camembert-courses/camembert-courses';
import { RayonCourses } from '../rayon-courses/rayon-courses';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { CategorieCourse } from '../../domain/models';

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
  imports: [CamembertCourses, RayonCourses],
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

  /** La teinte du rayon d'une ligne, pour son liseré et sa pastille. */
  protected teinteDe(categorie: CategorieCourse): string {
    return CATEGORIE_COURSE_PAR_ID.get(categorie)?.teinte ?? 'neutre';
  }

  protected libelleDe(categorie: CategorieCourse): string {
    return CATEGORIE_COURSE_PAR_ID.get(categorie)?.libelle ?? 'Autre';
  }
}
