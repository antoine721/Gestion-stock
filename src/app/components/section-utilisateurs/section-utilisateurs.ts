import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { REGIMES } from '../../domain/invites';
import { fmtEntier } from '../../domain/format';
import { Invite } from '../../domain/models';

/**
 * Les invites nommes. C'est la version « une personne = une fiche » de la
 * declaration d'invites : on attache un profil de consommation directement a
 * quelqu'un, plutot que de compter des anonymes par profil. Chaque fiche
 * ajoute une tete au calcul du bar et de la nourriture.
 */
@Component({
  selector: 'app-section-utilisateurs',
  templateUrl: './section-utilisateurs.html',
  styleUrl: './section-utilisateurs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionUtilisateurs {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly regimes = REGIMES;

  protected readonly sansProfil = computed(
    () => this.store.invitesNommes().filter((x) => !x.personneTypeId).length,
  );

  /** Le nom du createur de la fiche par defaut : moi, sinon le premier venu. */
  protected readonly porteurParDefaut = computed(
    () => this.store.moi()?.id ?? this.store.participants()[0]?.id ?? '',
  );

  protected ajouter(): void {
    const porteur = this.porteurParDefaut();
    if (porteur) this.store.ajouterInvite(porteur);
  }

  protected maj(invite: Invite, patch: Partial<Omit<Invite, 'id'>>): void {
    this.store.majInvite(invite.id, patch);
  }

  protected supprimer(invite: Invite): void {
    const nom = `${invite.prenom} ${invite.nom}`.trim() || 'cet invite';
    if (confirm(`Retirer ${nom} de la liste ?`)) this.store.supprimerInvite(invite.id);
  }
}
