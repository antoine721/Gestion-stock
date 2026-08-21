import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LignesCourses } from '../lignes-courses/lignes-courses';
import { BOISSON_PAR_ID, PRODUIT_PAR_ID } from '../../domain/catalogue';
import {
  COCKTAILS_COMPOSES,
  DILUANTS_POSSIBLES,
  RappelCocktail,
  SANS_DILUANT,
  regrouperCocktails,
} from '../../domain/bar';
import { LigneAchat } from '../../domain/models';
import { fmtEntier, fmtEuro, fmtNombre, fmtVolume } from '../../domain/format';

/** Une ligne d'achat prete a afficher : la biere se compte au litre. */
interface ItemAlcool {
  ligne: LigneAchat;
  auLitre: boolean;
  litres: number;
  prixAuLitre: number;
}

/**
 * Ce qu'on empile dans le tableau des alcools : des lignes d'achat, les
 * bandes qui ouvrent un cocktail compose, et les rappels des bouteilles
 * comptees ailleurs.
 */
type RangeeAlcool =
  | { type: 'bande'; cle: string; nom: string; verres: number; recette: string; total: number }
  | { type: 'ligne'; cle: string; item: ItemAlcool; cocktail: boolean }
  | { type: 'rappel'; cle: string; rappel: RappelCocktail };

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
   * Les recettes composees font bande a part : le prosecco et l'Aperol ne
   * disent rien tout seuls, ils ne valent que servis ensemble. On les montre
   * groupes, chacun gardant sa ligne — c'est bien deux bouteilles a acheter.
   */
  private readonly lignesAlcool = computed(() =>
    regrouperCocktails(
      this.store.panier().lignes.filter((x) => x.produit.degre > 0),
      this.store.panier().resumeBoissons,
    ),
  );

  /**
   * Le tableau des alcools, rangee par rangee : d'abord ce qui s'achete pour
   * lui-meme, du plus cher au moins cher, puis une bande coloree par recette
   * composee. Un seul tableau, pas trois : le regroupement est une couleur,
   * pas une comptabilite separee.
   */
  protected readonly rangees = computed<RangeeAlcool[]>(() => {
    const { groupes, autres } = this.lignesAlcool();
    const rangees: RangeeAlcool[] = autres
      .map((ligne) => this.enrichir(ligne))
      .sort((a, b) => b.ligne.prixTotal - a.ligne.prixTotal)
      .map((item) => ({ type: 'ligne', cle: item.ligne.produit.id, item, cocktail: false }));

    for (const groupe of groupes) {
      rangees.push({
        type: 'bande',
        cle: `bande-${groupe.boissonId}`,
        nom: groupe.nom,
        verres: groupe.verres,
        // La recette en clair : ce qui va ensemble dans le verre.
        recette: groupe.lignes
          .map((x) => x.produit.nom)
          .concat(groupe.rappels.map((x) => x.nom))
          .join(' + '),
        total: groupe.lignes.reduce((somme, x) => somme + x.prixTotal, 0),
      });
      for (const ligne of [...groupe.lignes].sort((a, b) => b.prixTotal - a.prixTotal)) {
        rangees.push({
          type: 'ligne',
          cle: ligne.produit.id,
          item: this.enrichir(ligne),
          cocktail: true,
        });
      }
      for (const rappel of groupe.rappels) {
        rangees.push({ type: 'rappel', cle: `${groupe.boissonId}-${rappel.nom}`, rappel });
      }
    }

    return rangees;
  });

  /**
   * La biere ne se compte pas en bouteilles mais en litres : on n'achete pas
   * « 50 bouteilles », on achete « 16,5 L », et c'est au litre qu'on compare
   * les prix au rayon.
   */
  private enrichir(ligne: LigneAchat): ItemAlcool {
    const contenance = ligne.produit.contenanceMl;
    return {
      ligne,
      auLitre: ligne.produit.categorie === 'biere',
      litres: (ligne.bouteilles * contenance) / 1000,
      prixAuLitre: contenance > 0 ? (ligne.produit.prixEur * 1000) / contenance : 0,
    };
  }

  /**
   * Ce qui se coupe, ce qui se boit sec, et ce qui porte son diluant dans sa
   * recette. Trois groupes : on voit d'un coup d'oeil ce qui reste a decider.
   */
  protected readonly groupesDiluants = computed(() => {
    const alcools = this.store.alcoolsADiluer();
    const composes = new Set(COCKTAILS_COMPOSES.map((x) => x.id));
    const cocktails = this.store
      .panier()
      .resumeBoissons.filter((x) => composes.has(x.boissonId))
      .map((x) => ({
        nom: BOISSON_PAR_ID.get(x.boissonId)?.nom ?? x.boissonId,
        verres: x.verres,
        // Ce que la recette porte deja : on le lit du catalogue plutot que de
        // le reecrire a la main a chaque nouvelle recette.
        compris: `${(BOISSON_PAR_ID.get(x.boissonId)?.composants ?? [])
          .map((c) => PRODUIT_PAR_ID.get(c.produitId)?.nom ?? c.produitId)
          .join(', ')} : la recette les porte.`,
      }));

    return {
      aCouper: alcools.filter((x) => !x.sec),
      secs: alcools.filter((x) => x.sec),
      cocktails,
    };
  });

  protected readonly diluantsPossibles = DILUANTS_POSSIBLES;
  protected readonly sansDiluant = SANS_DILUANT;

  /** Un alcool peut se couper de plusieurs facons : le besoin se partage. */
  protected ajouterDiluant(boissonId: string, produitId: string): void {
    if (!produitId) return;
    this.store.ajouterDiluant(boissonId, produitId);
  }

  protected retirerDiluant(boissonId: string, produitId: string): void {
    this.store.retirerDiluant(boissonId, produitId);
  }

  /** Ce qu'on peut encore associer a cet alcool : le reste du rayon. */
  protected restants(deja: readonly { produit: { id: string } }[]) {
    const pris = new Set(deja.map((x) => x.produit.id));
    return DILUANTS_POSSIBLES.filter((x) => !pris.has(x.id));
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

  /** Une quantite tapee a la main sur un diluant ; vide ou 0 = on le retire. */
  protected majQuantiteDiluant(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre)) return;
    this.majDiluant(produitId, Math.max(0, Math.round(nombre)));
  }

  /**
   * Prix et contenance des diluants, corrigeables comme ceux des alcools : la
   * bouteille de coca n'a pas le meme prix ni le meme format d'un magasin a
   * l'autre, et c'est ce chiffre-la qui decide combien il en faut.
   */
  protected majPrixDiluant(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majPrix(produitId, Math.max(0, nombre));
  }

  protected majContenanceDiluant(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre) && nombre > 0) this.store.majContenance(produitId, nombre);
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
