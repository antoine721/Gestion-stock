import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import {
  HEBERGEMENTS,
  LIBELLE_HEBERGEMENT,
  LIBELLE_REGIME,
  REGIMES,
  libelleConsommations,
} from '../../domain/invites';
import { fmtEntier, fmtEuro } from '../../domain/format';
import {
  CategoriePaiement,
  Invite,
  Logistique,
  Participant,
  ReponseFormulaire,
} from '../../domain/models';

type FiltrePaiement = 'tous' | 'paye' | 'non-paye';

/**
 * La base d'invites. Les reponses du formulaire arrivent en propositions a
 * valider ; une fois validees, chaque fiche s'affiche compacte — prenom, nom,
 * profil, paye — et se deplie a la demande pour le reste. Les filtres
 * remplacent les onglets par co-organisateur.
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
  protected readonly libelleRegime = LIBELLE_REGIME;
  protected readonly libelleConsommations = libelleConsommations;
  protected readonly hebergements = HEBERGEMENTS;
  protected readonly libelleHebergement = LIBELLE_HEBERGEMENT;

  /** « Permis · Voiture (3 places) · Cherche covoiturage » en une ligne. */
  protected resumeVoiture(logistique: Logistique): string {
    const morceaux: string[] = [];
    if (logistique.permis) morceaux.push('Permis');
    if (logistique.vehicule) {
      morceaux.push(
        logistique.placesVoiture > 0
          ? `Voiture (${logistique.placesVoiture} place(s) libre(s))`
          : 'Voiture',
      );
    }
    if (logistique.chercheCovoiturage) morceaux.push('Cherche un covoiturage');
    return morceaux.join(' · ');
  }

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

  protected nomDuParticipant(participantId: string): string {
    return this.store.participants().find((x) => x.id === participantId)?.nom ?? '?';
  }

  // -- Propositions : les reponses du formulaire a valider ------------------

  /** reponseId -> co-organisateur choisi pour la rattacher. */
  private readonly porteursChoisis = signal<ReadonlyMap<string, string>>(new Map());

  protected choisirPorteur(reponseId: string, participantId: string): void {
    this.porteursChoisis.set(new Map(this.porteursChoisis()).set(reponseId, participantId));
  }

  protected porteurDe(reponseId: string): string {
    return this.porteursChoisis().get(reponseId) ?? this.porteurParDefaut();
  }

  protected valider(reponse: ReponseFormulaire): void {
    const porteur = this.porteurDe(reponse.id);
    if (porteur) this.store.importerReponse(reponse.id, porteur);
  }

  protected ignorer(reponse: ReponseFormulaire): void {
    if (confirm(`Ignorer la reponse de ${reponse.prenom} ? Elle sera supprimee.`)) {
      this.store.supprimerReponse(reponse.id);
    }
  }

  protected dateDe(reponse: ReponseFormulaire): string {
    const date = new Date(reponse.creeLe);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
  }

  // -- Fiches : compactes, depliables a la demande --------------------------

  private readonly detailsOuverts = signal<ReadonlySet<string>>(new Set());

  protected estOuverte(inviteId: string): boolean {
    return this.detailsOuverts().has(inviteId);
  }

  protected basculerDetails(inviteId: string): void {
    const suivants = new Set(this.detailsOuverts());
    if (suivants.has(inviteId)) suivants.delete(inviteId);
    else suivants.add(inviteId);
    this.detailsOuverts.set(suivants);
  }

  protected ajouter(): void {
    const porteur = this.filtreParticipant() || this.porteurParDefaut();
    if (!porteur) return;
    const id = this.store.ajouterInvite(porteur);
    // Une fiche vierge s'ouvre depliee : il y a tout a remplir.
    this.basculerDetails(id);
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

  protected majLogistique(invite: Invite, patch: Partial<Logistique>): void {
    this.store.majInvite(invite.id, { logistique: { ...invite.logistique, ...patch } });
  }

  protected majPlacesVoiture(invite: Invite, valeur: string): void {
    const places = Number(valeur);
    if (Number.isFinite(places)) {
      this.majLogistique(invite, { placesVoiture: Math.min(9, Math.max(0, Math.round(places))) });
    }
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
