import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { fmtEntier, fmtEuro, fmtNombre, fmtVolume } from '../../domain/format';

/**
 * Le moteur, ouvert.
 *
 * Le calcul est la promesse de l'app : on lui confie le budget d'un festival.
 * Une promesse qu'on ne peut pas verifier n'en est pas une — cet ecran montre
 * donc chaque etape avec ses vrais chiffres, du verre declare a la bouteille
 * payee, et laisse toucher a ce qui merite de l'etre : les marges, la duree,
 * le prix d'une bouteille, sa contenance.
 *
 * Rien n'y est recalcule : tout vient du store, comme partout ailleurs. On ne
 * regarde pas une simulation, on regarde le calcul qui fait les courses.
 */
@Component({
  selector: 'app-calcul-detail',
  templateUrl: './calcul-detail.html',
  styleUrl: './calcul-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculDetail {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;
  protected readonly fmtVolume = fmtVolume;

  /** Les etapes de la chaine, avec le chiffre reel de chacune. */
  protected readonly etapes = computed(() => {
    const panier = this.store.panier();
    const cadre = this.store.cadre();
    const reglages = this.store.reglagesCalcul();
    const verresParJour = cadre.jours > 0 ? panier.verresTotal / cadre.jours : 0;

    return [
      {
        titre: 'Les invites',
        valeur: fmtEntier(cadre.invites),
        unite: 'personnes',
        detail: `dont ${fmtEntier(this.store.buveurs())} qui boivent de l'alcool`,
      },
      {
        titre: 'La duree',
        valeur: fmtEntier(cadre.jours),
        unite: cadre.jours > 1 ? 'jours' : 'jour',
        detail: 'chaque verre declare est un verre PAR JOUR',
      },
      {
        titre: 'Les verres',
        valeur: fmtNombre(panier.verresTotal),
        unite: 'verres',
        detail: `${fmtNombre(verresParJour)} par jour, tout le monde confondu`,
      },
      {
        titre: 'Le volume a servir',
        valeur: fmtVolume(panier.volumeServiMl),
        unite: '',
        detail: `${fmtVolume(panier.volumeAlcoolMl)} d'alcool, le reste en diluants`,
      },
      {
        titre: 'Le coup de pouce',
        valeur: `+${fmtNombre(reglages.coefficientPct)}`,
        unite: '%',
        detail: 'applique au besoin, avant les marges',
      },
      {
        titre: 'La marge de securite',
        valeur: `+${fmtNombre(reglages.margeAlcoolPct)}`,
        unite: '% sur l’alcool',
        detail: `+${fmtNombre(reglages.margeDiluantPct)} % sur les diluants`,
      },
      {
        titre: 'Le volume achete',
        valeur: fmtVolume(panier.volumeAcheteMl),
        unite: '',
        detail: `${fmtVolume(panier.volumeResteMl)} resteront sur les bras`,
      },
      {
        titre: 'L’addition',
        valeur: fmtEuro(panier.coutTotal),
        unite: '',
        detail: `${fmtEntier(panier.lignes.length)} reference(s) a acheter`,
      },
    ];
  });

  /** Le detail produit par produit : c'est la que le calcul se verifie. */
  protected readonly lignes = computed(() =>
    this.store
      .panier()
      .lignes.slice()
      .sort((a, b) => b.prixTotal - a.prixTotal),
  );

  protected readonly reglages = computed(() => this.store.reglagesCalcul());

  protected readonly modifie = computed(() => {
    const { margeAlcoolPct, margeDiluantPct, coefficientPct } = this.reglages();
    return margeAlcoolPct !== 10 || margeDiluantPct !== 25 || coefficientPct !== 0;
  });

  protected majReglage(
    champ: 'margeAlcoolPct' | 'margeDiluantPct' | 'coefficientPct',
    valeur: string,
  ): void {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre)) return;
    this.store.majReglageCalcul({ [champ]: Math.min(300, Math.max(0, nombre)) });
  }

  protected majJours(valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majCadre({ jours: Math.max(1, Math.round(nombre)) });
  }

  protected majPrix(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majPrix(produitId, Math.max(0, nombre));
  }

  protected majContenance(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majContenance(produitId, Math.max(0, nombre));
  }

  protected majQuantite(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre)) return;
    if (nombre <= 0) this.store.libererQuantite(produitId);
    else this.store.forcerQuantite(produitId, nombre);
  }
}
