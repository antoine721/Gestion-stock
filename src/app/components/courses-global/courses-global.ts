import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { CamembertCourses } from '../camembert-courses/camembert-courses';
import { GROUPES_COURSES } from '../../domain/courses';
import { fmtEntier, fmtEuro, fmtNombre } from '../../domain/format';

/**
 * L'onglet qui repond a « ou en est le caddie ? » : ce que ca coute, ce qui
 * est deja dans le chariot, comment ca se repartit, et si l'ensemble tient
 * debout. Rien ne s'y saisit — on y regarde.
 */
@Component({
  selector: 'app-courses-global',
  imports: [CamembertCourses],
  templateUrl: './courses-global.html',
  styleUrl: './courses-global.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesGlobal {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;

  /** Le total de chaque groupe, et ce qui y est deja coche. */
  protected readonly groupes = computed(() => {
    const lignes = this.store.listeCourses();
    return GROUPES_COURSES.map((groupe) => {
      const siennes = lignes.filter((x) => x.groupe === groupe.id);
      const cochees = siennes.filter((x) => x.cochee).length;
      return {
        ...groupe,
        lignes: siennes.length,
        cochees,
        total: siennes.reduce((somme, x) => somme + x.prix, 0),
        avancement: siennes.length === 0 ? 0 : Math.round((cochees / siennes.length) * 100),
      };
    }).filter((x) => x.lignes > 0);
  });

  protected readonly avancement = computed(() => {
    const resume = this.store.resumeCourses();
    return resume.lignes === 0 ? 0 : Math.round((resume.cochees / resume.lignes) * 100);
  });

  /**
   * Les ratios qui disent si la soiree tient debout : assez de diluant, pas
   * une seule boisson qui ecrase tout. Les ratios vides — ceux qu'on ne peut
   * pas evaluer faute de saisie — ne servent qu'a inquieter, on les cache.
   */
  protected readonly equilibre = computed(() =>
    this.store.ratios().filter((x) => x.groupe === 'equilibre' && x.etat !== 'vide'),
  );

  protected readonly logistique = computed(() =>
    this.store.ratios().filter((x) => x.groupe === 'logistique' && x.etat !== 'vide'),
  );

  /** La couverture du besoin en diluant, en pourcentage plafonne a 100. */
  protected readonly couvertureDiluant = computed(() =>
    Math.min(100, Math.round(this.store.diluants().couverture * 100)),
  );
}
