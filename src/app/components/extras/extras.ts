import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { LIBELLE_CATEGORIE, ORDRE_CATEGORIE, PRODUITS } from '../../domain/catalogue';
import { fmtEuro, fmtVolume } from '../../domain/format';

/**
 * Les extras : bouteilles achetees en quantite fixe, hors calcul par personne.
 * La Chartreuse qu'on prendra de toute facon, quel que soit le nombre d'invites.
 * L'ajout passe par une modale ; la quantite se regle ensuite au compteur, sur
 * la ligne — c'est le seul reglage, un panneau serait de trop.
 */
@Component({
  selector: 'app-extras',
  imports: [Modale],
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

  protected readonly creationOuverte = signal(false);
  protected readonly brouillon = signal({ produitId: '', bouteilles: 1 });

  protected readonly creationInvalide = computed(() => this.brouillon().produitId === '');

  protected ouvrirCreation(): void {
    this.brouillon.set({ produitId: '', bouteilles: 1 });
    this.creationOuverte.set(true);
  }

  protected majBrouillon(patch: Partial<{ produitId: string; bouteilles: number }>): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected creer(): void {
    const brouillon = this.brouillon();
    if (!brouillon.produitId) return;
    this.store.ajouterExtra(brouillon.produitId);
    this.store.majQuantiteExtra(brouillon.produitId, Math.max(1, brouillon.bouteilles));
    this.creationOuverte.set(false);
  }

  protected majQuantite(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majQuantiteExtra(produitId, nombre);
  }

  protected incrementer(produitId: string, actuel: number, pas: number): void {
    this.store.majQuantiteExtra(produitId, actuel + pas);
  }
}
