import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LIBELLE_CATEGORIE, ORDRE_CATEGORIE, PRODUITS_PAR_FORMAT } from '../../domain/catalogue';
import { fmtEntier, fmtEuro, fmtVolume } from '../../domain/format';
import { Categorie, LigneAchat, Produit } from '../../domain/models';

interface Bloc {
  categorie: Categorie;
  libelle: string;
  lignes: LigneAchat[];
  cout: number;
}

/** US3 / US4 / US5 - La liste de courses, ses ajustements et son detail. */
@Component({
  selector: 'app-liste-courses',
  templateUrl: './liste-courses.html',
  styleUrl: './liste-courses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListeCourses {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtVolume = fmtVolume;

  protected readonly deplie = signal<ReadonlySet<string>>(new Set());

  protected readonly blocs = computed<Bloc[]>(() => {
    const lignes = this.store.lignesCourses();
    return ORDRE_CATEGORIE.map((categorie) => {
      const duBloc = lignes.filter((x) => x.produit.categorie === categorie);
      return {
        categorie,
        libelle: LIBELLE_CATEGORIE[categorie],
        lignes: duBloc,
        cout: duBloc.reduce((somme, x) => somme + x.prixTotal, 0),
      };
    }).filter((bloc) => bloc.lignes.length > 0);
  });

  protected readonly parPersonne = computed(() => {
    const panier = this.store.panier();
    const invites = Math.max(1, this.store.cadre().invites);
    return { base: panier.coutBase / invites, total: panier.coutTotal / invites };
  });

  protected conditionnements(formatId: string): readonly Produit[] {
    return PRODUITS_PAR_FORMAT.get(formatId) ?? [];
  }

  protected basculerDetail(produitId: string): void {
    this.deplie.update((courant) => {
      const copie = new Set(courant);
      if (copie.has(produitId)) copie.delete(produitId);
      else copie.add(produitId);
      return copie;
    });
  }

  protected majQuantite(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.forcerQuantite(produitId, nombre);
  }

  protected majPrix(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majPrix(produitId, nombre);
  }

  protected majContenance(produitId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre) && nombre > 0) this.store.majContenance(produitId, nombre);
  }

  protected majPrixTireuse(valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre) && nombre >= 0) this.store.majPrixTireuse(nombre);
  }
}
