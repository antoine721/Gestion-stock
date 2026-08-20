import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LignesCourses } from '../lignes-courses/lignes-courses';
import { BOISSON_PAR_ID } from '../../domain/catalogue';
import { DILUANTS_POSSIBLES, SANS_DILUANT } from '../../domain/bar';
import { fmtEntier, fmtEuro, fmtNombre, fmtVolume } from '../../domain/format';

/**
 * L'onglet du bar : ce qu'on achete en alcool, et ce avec quoi on le coupe.
 *
 * Les diluants sont la piece manquante de l'app depuis le debut. Le moteur ne
 * les achete pas — le format et la marque se decident devant le rayon, et
 * personne ne veut se voir imposer dix-sept bouteilles de tonic — mais il sait
 * exactement combien de coca reclament les rhum-cocas prevus. On met ce besoin
 * sous les yeux, avec un compteur pour le couvrir en un clic.
 */
@Component({
  selector: 'app-courses-bar',
  imports: [LignesCourses],
  templateUrl: './courses-bar.html',
  styleUrl: './courses-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesBar {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;
  protected readonly fmtVolume = fmtVolume;

  /** Les lignes de la liste de courses qui viennent du bar. */
  protected readonly lignesBar = computed(() =>
    this.store.listeCourses().filter((x) => x.groupe === 'bar'),
  );

  /**
   * Les alcools, du plus cher au moins cher : la ou part l'argent.
   *
   * La biere ne se compte pas en bouteilles mais en litres : on n'achete pas
   * « 50 bouteilles », on achete « 16,5 L », et c'est au litre qu'on compare
   * les prix au rayon.
   */
  protected readonly alcools = computed(() =>
    this.store
      .panier()
      .lignes.filter((x) => x.produit.degre > 0)
      .map((ligne) => {
        const contenance = ligne.produit.contenanceMl;
        const litres = (ligne.bouteilles * contenance) / 1000;
        return {
          ligne,
          auLitre: ligne.produit.categorie === 'biere',
          litres,
          prixAuLitre: contenance > 0 ? (ligne.produit.prixEur * 1000) / contenance : 0,
        };
      })
      .sort((a, b) => b.ligne.prixTotal - a.ligne.prixTotal),
  );

  /**
   * Ce qui se coupe, ce qui se boit sec, et ce qui porte son diluant dans sa
   * recette. Trois groupes : on voit d'un coup d'oeil ce qui reste a decider.
   */
  protected readonly groupesDiluants = computed(() => {
    const alcools = this.store.alcoolsADiluer();
    const cocktails = this.store
      .panier()
      .resumeBoissons.filter((x) => x.boissonId === 'spritz' || x.boissonId === 'kir')
      .map((x) => ({
        nom: BOISSON_PAR_ID.get(x.boissonId)?.nom ?? x.boissonId,
        verres: x.verres,
        compris:
          x.boissonId === 'spritz'
            ? 'Prosecco, Aperol et eau petillante : la recette les porte.'
            : 'Vin blanc et creme de cassis : la recette les porte.',
      }));

    return {
      aCouper: alcools.filter((x) => !x.sec),
      secs: alcools.filter((x) => x.sec),
      cocktails,
    };
  });

  protected readonly diluantsPossibles = DILUANTS_POSSIBLES;
  protected readonly sansDiluant = SANS_DILUANT;

  protected choisirDiluant(boissonId: string, produitId: string): void {
    this.store.majDiluant(boissonId, produitId);
  }

  protected readonly couverture = computed(() =>
    Math.min(100, Math.round(this.store.diluants().couverture * 100)),
  );

  /** Ce qu'on peut encore ajouter : le catalogue moins ce qui est deja pose. */
  protected readonly ajoutables = computed(() => {
    const deja = new Set(this.store.diluants().lignes.map((x) => x.produit.id));
    return DILUANTS_POSSIBLES.filter((x) => !deja.has(x.id));
  });

  protected readonly ajout = signal('');

  protected ajouter(): void {
    const produitId = this.ajout();
    if (!produitId) return;
    this.store.ajouterExtra(produitId);
    this.ajout.set('');
  }

  protected majDiluant(produitId: string, bouteilles: number): void {
    if (bouteilles <= 0) this.store.retirerExtra(produitId);
    else this.store.majQuantiteExtra(produitId, bouteilles);
  }

  /** Poser d'un coup ce que les recettes reclament : le geste le plus courant. */
  protected completer(produitId: string, conseille: number): void {
    this.store.majQuantiteExtra(produitId, Math.max(1, conseille));
  }

  protected toutCompleter(): void {
    for (const ligne of this.store.diluants().lignes) {
      if (ligne.manque > 0) this.store.majQuantiteExtra(ligne.produit.id, ligne.conseille);
    }
  }

  /** Une quantite forcee a la main sur un alcool ; vide = le calcul decide. */
  protected majAlcool(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre)) return;
    if (nombre <= 0) this.store.libererQuantite(produitId);
    else this.store.forcerQuantite(produitId, nombre);
  }
}
