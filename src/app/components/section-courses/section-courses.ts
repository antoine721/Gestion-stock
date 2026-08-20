import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { CoursesBar } from '../courses-bar/courses-bar';
import { CoursesCuisine } from '../courses-cuisine/courses-cuisine';
import { CoursesGlobal } from '../courses-global/courses-global';
import { CoursesSupplements } from '../courses-supplements/courses-supplements';
import { fmtEntier, fmtEuro } from '../../domain/format';

type Onglet = 'global' | 'bar' | 'cuisine' | 'supplements';

/**
 * La liste de courses unifiee, en quatre onglets. Tout affiche d'un bloc, elle
 * demandait de lire trois cents lignes pour repondre a « il me manque quoi
 * au bar ? ». Chaque onglet repond a une question : ou en est-on, qu'est-ce
 * qu'on boit, qu'est-ce qu'on mange, qu'est-ce qu'on a oublie.
 */
@Component({
  selector: 'app-section-courses',
  imports: [CoursesBar, CoursesCuisine, CoursesGlobal, CoursesSupplements],
  templateUrl: './section-courses.html',
  styleUrl: './section-courses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionCourses {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;

  protected readonly onglets: { id: Onglet; libelle: string; emoji: string }[] = [
    { id: 'global', libelle: 'Global', emoji: '📊' },
    { id: 'bar', libelle: 'Bar & boissons', emoji: '🍹' },
    { id: 'cuisine', libelle: 'Cuisine', emoji: '🍳' },
    { id: 'supplements', libelle: 'Achats en plus', emoji: '🛒' },
  ];

  protected readonly onglet = signal<Onglet>('global');
}
