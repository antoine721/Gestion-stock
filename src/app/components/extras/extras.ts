import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LIBELLE_CATEGORIE, ORDRE_CATEGORIE, PRODUITS } from '../../domain/catalogue';
import { fmtEuro, fmtVolume } from '../../domain/format';

/**
 * Les extras : bouteilles achetees en quantite fixe, hors calcul par personne.
 * La Chartreuse qu'on prendra de toute facon, quel que soit le nombre d'invites.
 */
@Component({
  selector: 'app-extras',
  templateUrl: './extras.html',
  styleUrl: './extras.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Extras {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtVolume = fmtVolume;

  /** Le catalogue moins ce qui est deja en extra, groupe par rayon. */
  protected readonly catalogue = computed(() => {
    const deja = new Set(this.store.extras().map((x) => x.produit.id));
    return ORDRE_CATEGORIE.map((categorie) => ({
      libelle: LIBELLE_CATEGORIE[categorie],
      produits: PRODUITS.filter((x) => x.categorie === categorie && !deja.has(x.id)),
    })).filter((x) => x.produits.length > 0);
  });

  protected ajouter(evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    if (select.value) this.store.ajouterExtra(select.value);
    select.value = '';
  }

  protected majQuantite(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majQuantiteExtra(produitId, nombre);
  }

  protected incrementer(produitId: string, actuel: number, pas: number): void {
    this.store.majQuantiteExtra(produitId, actuel + pas);
  }
}
