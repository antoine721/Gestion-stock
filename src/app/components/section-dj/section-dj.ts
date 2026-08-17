import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { STATUTS_DJ_SET, nomDeRef, trierDjSets, volontaires } from '../../domain/programme';
import { fmtEntier } from '../../domain/format';
import { DjSet } from '../../domain/models';

/**
 * Le coin DJ : le tableau horaire des sets et son workflow. Un invite
 * demande un creneau, l'orga valide (ou refuse), et le set finit « joue ».
 * Les envies musicales collectees par le formulaire nourrissent le tout.
 */
@Component({
  selector: 'app-section-dj',
  templateUrl: './section-dj.html',
  styleUrl: './section-dj.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionDj {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly statuts = STATUTS_DJ_SET;

  protected readonly sets = computed(() => trierDjSets(this.store.djSets()));

  protected readonly jours = computed(() =>
    Array.from({ length: Math.max(1, this.store.partage().jours) }, (_, i) => i + 1),
  );

  /** Les invites qui se sont proposes comme DJ, d'apres leurs fiches. */
  protected readonly volontairesDj = computed(() =>
    volontaires(this.store.invitesNommes()).filter((x) => /dj|mix|platine/i.test(x.envies)),
  );

  protected nomDe(ref: string): string {
    return nomDeRef(ref, this.store.participants(), this.store.invitesNommes()) || ref;
  }

  protected maj(set: DjSet, patch: Partial<Omit<DjSet, 'id'>>): void {
    this.store.majDjSet(set.id, patch);
  }

  protected majJour(set: DjSet, valeur: string): void {
    const jour = Number(valeur);
    if (Number.isFinite(jour)) this.store.majDjSet(set.id, { jour: Math.max(1, Math.round(jour)) });
  }

  /** Un volontaire devient une demande de set, d'un clic. */
  protected proposerVolontaire(inviteId: string): void {
    this.store.ajouterDjSet({ dj: `inv:${inviteId}`, statut: 'demande' });
  }

  protected supprimer(set: DjSet): void {
    if (confirm(`Retirer ce set (${this.nomDe(set.dj) || 'sans DJ'}) du tableau ?`)) {
      this.store.supprimerDjSet(set.id);
    }
  }
}
