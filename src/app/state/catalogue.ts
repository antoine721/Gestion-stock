import { Injectable, signal } from '@angular/core';
import {
  ProduitCatalogue,
  chercherProduits,
  normaliserProduitCatalogue,
} from '../domain/catalogue-produits';

/** Le fichier est servi tel quel depuis `public/`. */
const FICHIER = 'produits.json';

/**
 * Le catalogue du rayon, charge une fois pour la session.
 *
 * Pres de 2 500 produits, 70 ko une fois compresse : on les prend en entier
 * au premier affichage du rayon, et toutes les recherches suivantes se font
 * en memoire.
 * C'est ce qui rend la barre de recherche instantanee, et ce qui la fait
 * marcher meme quand le reseau du terrain de camping ne marche pas.
 */
@Injectable({ providedIn: 'root' })
export class Catalogue {
  private readonly produits = signal<readonly ProduitCatalogue[]>([]);
  /** Le chargement en cours : deux ecrans qui l'ouvrent ne le font qu'une fois. */
  private enCours?: Promise<void>;

  readonly pret = signal(false);
  readonly erreur = signal('');

  charger(): Promise<void> {
    this.enCours ??= this.telecharger();
    return this.enCours;
  }

  chercher(requete: string): ProduitCatalogue[] {
    return chercherProduits(this.produits(), requete);
  }

  private async telecharger(): Promise<void> {
    try {
      const reponse = await fetch(FICHIER);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const brut: unknown = await reponse.json();
      if (!Array.isArray(brut)) throw new Error('Catalogue illisible');
      this.produits.set(brut.map((x) => normaliserProduitCatalogue(x)));
      this.pret.set(true);
    } catch {
      // Le rayon reste utilisable a la main : on le dit, on ne bloque rien.
      this.erreur.set('Catalogue indisponible. Les produits restent ajoutables a la main.');
      // Un echec ne doit pas condamner la session : le prochain affichage
      // du rayon retentera.
      this.enCours = undefined;
    }
  }
}
