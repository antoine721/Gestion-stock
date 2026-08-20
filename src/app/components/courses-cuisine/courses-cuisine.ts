import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LignesCourses } from '../lignes-courses/lignes-courses';
import { LigneCuisine, MOMENTS } from '../../domain/nourriture';
import { MomentRepas } from '../../domain/models';
import { fmtEntier, fmtEuro, fmtNombre } from '../../domain/format';

type Colonne = 'nom' | 'quantite' | 'prix' | 'jour';

/** Une ligne de cuisine vue a travers les filtres jour et moment. */
interface LigneFiltree {
  ligne: LigneCuisine;
  /** Le besoin retenu par le filtre, dans l'unite de dosage. */
  besoinFiltre: number;
  /** Les repas retenus, « J1 midi · J2 soir ». */
  pour: string;
  /** Le premier jour qui le reclame : ce qui sert au tri chronologique. */
  premierJour: number;
}

/**
 * La cuisine, en tableau triable. Un ingredient qui sert trois soirs ne fait
 * qu'une ligne de courses — c'est ce qui permet un seul arrondi — mais on veut
 * pouvoir demander « et pour le samedi soir, il me faut quoi ? ». Les filtres
 * repondent a ca sans toucher au calcul : ils ne changent que ce qu'on lit.
 */
@Component({
  selector: 'app-courses-cuisine',
  imports: [LignesCourses],
  templateUrl: './courses-cuisine.html',
  styleUrl: './courses-cuisine.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesCuisine {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;
  protected readonly moments = MOMENTS;

  protected readonly filtreJour = signal(0);
  protected readonly filtreMoment = signal<MomentRepas | ''>('');
  protected readonly colonne = signal<Colonne>('nom');
  protected readonly croissant = signal(true);

  protected readonly jours = computed(() =>
    Array.from({ length: Math.max(1, this.store.partage().jours) }, (_, i) => i + 1),
  );

  protected readonly filtreActif = computed(
    () => this.filtreJour() > 0 || this.filtreMoment() !== '',
  );

  protected readonly lignes = computed<LigneFiltree[]>(() => {
    const jour = this.filtreJour();
    const moment = this.filtreMoment();
    const libelle = new Map(MOMENTS.map((x) => [x.id, x.libelle.toLowerCase()]));

    const retenues = this.store.lignesCuisine().flatMap((ligne) => {
      const parts = ligne.pourRepas.filter(
        (x) => (jour === 0 || x.jour === jour) && (moment === '' || x.moment === moment),
      );
      if (parts.length === 0) return [];
      return [
        {
          ligne,
          besoinFiltre: parts.reduce((somme, x) => somme + x.quantite, 0),
          pour: parts.map((x) => `J${x.jour} ${libelle.get(x.moment) ?? ''}`).join(' · '),
          premierJour: Math.min(...parts.map((x) => x.jour)),
        },
      ];
    });

    const sens = this.croissant() ? 1 : -1;
    const colonne = this.colonne();
    return retenues.sort((a, b) => {
      if (colonne === 'quantite') return (a.besoinFiltre - b.besoinFiltre) * sens;
      if (colonne === 'prix') return (a.ligne.prixTotal - b.ligne.prixTotal) * sens;
      if (colonne === 'jour') return (a.premierJour - b.premierJour) * sens;
      return a.ligne.nom.localeCompare(b.ligne.nom) * sens;
    });
  });

  protected readonly totalFiltre = computed(() =>
    this.lignes().reduce((somme, x) => somme + x.ligne.prixTotal, 0),
  );

  /** Les lignes a cocher de la cuisine et du grignotage. */
  protected readonly aCocher = computed(() =>
    this.store.listeCourses().filter((x) => x.groupe === 'cuisine' || x.groupe === 'grignotage'),
  );

  protected trier(colonne: Colonne): void {
    if (this.colonne() === colonne) this.croissant.set(!this.croissant());
    else {
      this.colonne.set(colonne);
      // Un nom se lit de A a Z, un chiffre du plus gros au plus petit.
      this.croissant.set(colonne === 'nom' || colonne === 'jour');
    }
  }

  protected fleche(colonne: Colonne): string {
    if (this.colonne() !== colonne) return '';
    return this.croissant() ? '↑' : '↓';
  }

  protected reinitialiser(): void {
    this.filtreJour.set(0);
    this.filtreMoment.set('');
  }
}
