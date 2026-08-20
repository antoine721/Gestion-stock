import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Participant } from '../../domain/models';
import { fmtEntier } from '../../domain/format';

/**
 * Les co-organisateurs : ceux que les invites cochent dans le formulaire a la
 * question « qui t'invite ? ». Ils vivent avec la fiche de l'evenement, pas
 * dans la base d'invites — ce ne sont pas des invites, ce sont les hotes.
 */
@Component({
  selector: 'app-co-organisateurs',
  templateUrl: './co-organisateurs.html',
  styleUrl: './co-organisateurs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoOrganisateurs {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;

  /** Combien de fiches d'invites cette personne amene. */
  protected fichesDe(participantId: string): number {
    return this.store.invitesNommes().filter((x) => x.participantId === participantId).length;
  }

  protected async ajouter(): Promise<void> {
    const nom = prompt('Prenom du co-organisateur a ajouter ?');
    if (nom?.trim()) await this.store.ajouterParticipant(nom.trim());
  }

  protected async retirer(participant: Participant): Promise<void> {
    if (confirm(`Retirer ${participant.nom} et ses invites de l'evenement ?`)) {
      await this.store.retirerParticipant(participant.id);
    }
  }
}
