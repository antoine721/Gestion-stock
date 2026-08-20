import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import { CategoriePaiement } from '../../domain/models';
import { fmtEntier, fmtEuro } from '../../domain/format';

/**
 * Les tarifs : les categories de participation et ce qu'elles rapportent.
 * Elles vivent avec le budget, pas avec la base d'invites — c'est une question
 * d'argent, la fiche de l'invite ne fait que porter la categorie choisie.
 */
@Component({
  selector: 'app-tarifs',
  imports: [Modale, Panneau],
  templateUrl: './tarifs.html',
  styleUrl: './tarifs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tarifs {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtEuro = fmtEuro;

  protected readonly creationOuverte = signal(false);
  protected readonly brouillon = signal({ nom: '', montant: 0 });
  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.store.categoriesPaiement().find((x) => x.id === this.detailId()),
  );

  protected readonly invalide = computed(() => this.brouillon().nom.trim() === '');

  protected ouvrirCreation(): void {
    this.brouillon.set({ nom: '', montant: 0 });
    this.creationOuverte.set(true);
  }

  protected majBrouillon(patch: Partial<{ nom: string; montant: number }>): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected creer(): void {
    const brouillon = this.brouillon();
    if (!brouillon.nom.trim()) return;
    const id = this.store.ajouterCategoriePaiement();
    this.store.majCategoriePaiement(id, {
      nom: brouillon.nom.trim(),
      montant: Math.max(0, brouillon.montant),
    });
    this.creationOuverte.set(false);
  }

  /** Combien d'invites portent ce tarif, et combien l'ont deja regle. */
  protected usage(categorieId: string): { total: number; payes: number } {
    const concernes = this.store
      .invitesNommes()
      .filter((x) => x.categoriePaiementId === categorieId);
    return { total: concernes.length, payes: concernes.filter((x) => x.paye).length };
  }

  protected majNom(categorie: CategoriePaiement, nom: string): void {
    this.store.majCategoriePaiement(categorie.id, { nom });
  }

  protected majMontant(categorie: CategoriePaiement, valeur: string): void {
    const montant = Number(valeur);
    if (Number.isFinite(montant)) {
      this.store.majCategoriePaiement(categorie.id, { montant: Math.max(0, montant) });
    }
  }

  protected supprimer(categorie: CategoriePaiement): void {
    if (confirm(`Supprimer la categorie « ${categorie.nom || 'sans nom'} » ?`)) {
      this.store.supprimerCategoriePaiement(categorie.id);
      if (this.detailId() === categorie.id) this.detailId.set('');
    }
  }
}
