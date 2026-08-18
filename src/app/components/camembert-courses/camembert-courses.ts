import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PartCategorie } from '../../domain/categories-courses';
import { fmtEuro, fmtNombre } from '../../domain/format';

/** Le trace d'une part : sa portion d'anneau, prete a poser dans le SVG. */
interface Arc {
  part: PartCategorie;
  longueur: number;
  reste: number;
  decalage: number;
}

/** Rayon et epaisseur de l'anneau, en unites du viewBox. */
const RAYON = 60;
const EPAISSEUR = 22;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

/**
 * Ou part l'argent des courses, rayon par rayon.
 *
 * Un anneau plutot qu'un camembert plein : le trou du milieu porte le total,
 * qui est l'autre chose qu'on vient chercher ici. Chaque part est separee de
 * sa voisine par un vrai blanc — sans quoi deux teintes proches se lisent
 * comme une seule.
 *
 * La couleur ne porte jamais l'information seule : la legende nomme chaque
 * rayon et affiche son montant, et la liste de courses juste en dessous
 * redonne le detail ligne a ligne.
 */
@Component({
  selector: 'app-camembert-courses',
  templateUrl: './camembert-courses.html',
  styleUrl: './camembert-courses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CamembertCourses {
  readonly parts = input<readonly PartCategorie[]>([]);
  readonly total = input(0);

  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtNombre = fmtNombre;
  protected readonly rayon = RAYON;
  protected readonly epaisseur = EPAISSEUR;

  /** La part survolee, mise en avant dans l'anneau comme dans la legende. */
  protected readonly survolee = signal('');

  protected readonly arcs = computed<Arc[]>(() => {
    const parts = this.parts();
    // Un blanc de 2 unites entre deux parts, sauf s'il n'y en a qu'une :
    // couper un anneau plein en un point n'apporte rien.
    const ecart = parts.length > 1 ? 2 : 0;
    let cumul = 0;
    return parts.map((part) => {
      const brute = (part.part / 100) * CIRCONFERENCE;
      // Une part minuscule doit rester visible, mais jamais deborder sur la
      // suivante : on lui garde un trait, pas une place.
      const longueur = Math.max(0, Math.min(brute - ecart, brute));
      const arc = { part, longueur, reste: CIRCONFERENCE - longueur, decalage: -cumul };
      cumul += brute;
      return arc;
    });
  });

  protected estEnAvant(categorie: string): boolean {
    return this.survolee() === '' || this.survolee() === categorie;
  }
}
