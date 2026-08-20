import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LigneCourses } from '../../domain/courses';
import { CATEGORIE_COURSE_PAR_ID } from '../../domain/categories-courses';
import { CategorieCourse } from '../../domain/models';
import { fmtEuro } from '../../domain/format';

/**
 * Une liste de lignes a cocher. Les quatre onglets des courses montrent les
 * memes lignes sous des angles differents — autant n'ecrire la ligne qu'une
 * fois. Les coches sont partagees entre co-organisateurs.
 */
@Component({
  selector: 'app-lignes-courses',
  templateUrl: './lignes-courses.html',
  styleUrl: './lignes-courses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LignesCourses {
  readonly lignes = input.required<LigneCourses[]>();
  /** Ce qu'on affiche quand il n'y a rien a acheter dans ce groupe. */
  readonly vide = input('Rien a acheter ici pour l instant.');

  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;

  protected teinteDe(categorie: CategorieCourse): string {
    return CATEGORIE_COURSE_PAR_ID.get(categorie)?.teinte ?? 'neutre';
  }

  protected libelleDe(categorie: CategorieCourse): string {
    return CATEGORIE_COURSE_PAR_ID.get(categorie)?.libelle ?? 'Autre';
  }

  /**
   * La miniature vient d'un hebergeur tiers : si elle tombe, la ligne se lit
   * tres bien sans, et une image cassee ne doit pas la defigurer.
   */
  protected masquerImage(evenement: Event): void {
    (evenement.target as HTMLElement).style.display = 'none';
  }
}
