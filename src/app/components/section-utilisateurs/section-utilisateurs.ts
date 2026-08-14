import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { REGIMES } from '../../domain/invites';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { CategoriePaiement, Invite, Participant } from '../../domain/models';

type FiltrePaiement = 'tous' | 'paye' | 'non-paye';

/**
 * La base d'invites : une fiche par personne, et tout s'y rattache — le
 * profil de consommation, le regime, le paiement. C'est elle qui fait les
 * tetes du calcul ; l'ancienne saisie anonyme par profil n'a plus d'ecran.
 * Les filtres remplacent les onglets par co-organisateur.
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
  protected readonly fmtEuro = fmtEuro;
  protected readonly regimes = REGIMES;

  // -- Filtres : ils remplacent les onglets par co-organisateur ------------

  protected readonly filtreParticipant = signal('');
  protected readonly filtreProfil = signal('');
  protected readonly filtrePaiement = signal<FiltrePaiement>('tous');

  protected readonly filtresActifs = computed(
    () =>
      this.filtreParticipant() !== '' ||
      this.filtreProfil() !== '' ||
      this.filtrePaiement() !== 'tous',
  );

  protected readonly invitesFiltres = computed(() => {
    const participant = this.filtreParticipant();
    const profil = this.filtreProfil();
    const paiement = this.filtrePaiement();

    return this.store.invitesNommes().filter((invite) => {
      if (participant && invite.participantId !== participant) return false;
      if (profil === 'sans' && invite.personneTypeId) return false;
      if (profil && profil !== 'sans' && invite.personneTypeId !== profil) return false;
      if (paiement === 'paye' && !invite.paye) return false;
      if (paiement === 'non-paye' && invite.paye) return false;
      return true;
    });
  });

  protected reinitialiserFiltres(): void {
    this.filtreParticipant.set('');
    this.filtreProfil.set('');
    this.filtrePaiement.set('tous');
  }

  protected readonly sansProfil = computed(
    () => this.store.invitesNommes().filter((x) => !x.personneTypeId).length,
  );

  /** Le porteur de la fiche par defaut : moi, sinon le premier venu. */
  protected readonly porteurParDefaut = computed(
    () => this.store.moi()?.id ?? this.store.participants()[0]?.id ?? '',
  );

  protected fichesDe(participantId: string): number {
    return this.store.invitesNommes().filter((x) => x.participantId === participantId).length;
  }

  protected tarifDe(invite: Invite): CategoriePaiement | undefined {
    return this.store.categoriesPaiement().find((x) => x.id === invite.categoriePaiementId);
  }

  // -- Fiches ---------------------------------------------------------------

  protected ajouter(): void {
    const porteur = this.filtreParticipant() || this.porteurParDefaut();
    if (porteur) this.store.ajouterInvite(porteur);
  }

  protected maj(invite: Invite, patch: Partial<Omit<Invite, 'id'>>): void {
    this.store.majInvite(invite.id, patch);
  }

  protected majNombre(
    invite: Invite,
    champ: 'montantPaye' | 'joursPresence',
    valeur: string,
  ): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majInvite(invite.id, { [champ]: Math.max(0, nombre) });
  }

  /** Cocher « a paye » pre-remplit le montant avec le tarif de sa categorie. */
  protected basculerPaye(invite: Invite): void {
    const paye = !invite.paye;
    const tarif = this.tarifDe(invite);
    this.store.majInvite(invite.id, {
      paye,
      montantPaye: paye && invite.montantPaye === 0 && tarif ? tarif.montant : invite.montantPaye,
    });
  }

  protected supprimer(invite: Invite): void {
    const nom = `${invite.prenom} ${invite.nom}`.trim() || 'cet invite';
    if (confirm(`Retirer ${nom} de la liste ?`)) this.store.supprimerInvite(invite.id);
  }

  // -- Co-organisateurs -----------------------------------------------------

  protected async ajouterCoOrganisateur(): Promise<void> {
    const nom = prompt('Prenom du co-organisateur a ajouter ?');
    if (nom?.trim()) await this.store.ajouterParticipant(nom.trim());
  }

  protected async retirerCoOrganisateur(participant: Participant): Promise<void> {
    if (confirm(`Retirer ${participant.nom} et ses invites de l'evenement ?`)) {
      await this.store.retirerParticipant(participant.id);
    }
  }

  // -- Categories de paiement -----------------------------------------------

  protected majCategorieNom(categorie: CategoriePaiement, nom: string): void {
    this.store.majCategoriePaiement(categorie.id, { nom });
  }

  protected majCategorieMontant(categorie: CategoriePaiement, valeur: string): void {
    const montant = Number(valeur);
    if (Number.isFinite(montant)) {
      this.store.majCategoriePaiement(categorie.id, { montant: Math.max(0, montant) });
    }
  }

  protected supprimerCategorie(categorie: CategoriePaiement): void {
    if (confirm(`Supprimer la categorie « ${categorie.nom || 'sans nom'} » ?`)) {
      this.store.supprimerCategoriePaiement(categorie.id);
    }
  }
}
