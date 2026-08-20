import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LignesCourses } from '../lignes-courses/lignes-courses';
import { RayonCourses } from '../rayon-courses/rayon-courses';
import { fmtEntier, fmtEuro } from '../../domain/format';

/**
 * Les achats supplementaires : tout ce qu'aucun moteur ne calcule. Les sacs
 * poubelle, la glace, le charbon, le paracetamol du dimanche matin. C'est
 * l'onglet ou l'on pose ce a quoi personne n'avait pense.
 */
@Component({
  selector: 'app-courses-supplements',
  imports: [LignesCourses, RayonCourses],
  templateUrl: './courses-supplements.html',
  styleUrl: './courses-supplements.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesSupplements {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;

  protected readonly poses = computed(() =>
    this.store.listeCourses().filter((x) => x.groupe === 'rayon'),
  );

  protected readonly materiel = computed(() =>
    this.store.listeCourses().filter((x) => x.groupe === 'materiel'),
  );

  protected readonly total = computed(() =>
    [...this.poses(), ...this.materiel()].reduce((somme, x) => somme + x.prix, 0),
  );
}
