import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import { ValidationFiche } from '../validation-fiche/validation-fiche';
import {
  LIBELLE_REGIME,
  REGIMES,
  TACHES_INVITE,
  TacheInvite,
  etatTaches,
  neBoitPas,
  presenceComplete,
  tousLesJours,
} from '../../domain/invites';
import { boissonsBues, libelleGoodies, libelleServices } from '../../domain/preferences';
import { dateDuJour } from '../../domain/evenement';
import { fmtEntier, fmtEuro, fmtNombre } from '../../domain/format';
import {
  CategoriePaiement,
  Invite,
  Logistique,
  Participant,
  ReponseFormulaire,
} from '../../domain/models';

/** Le filtre « il me reste quoi a faire sur cette personne ? ». */
type FiltreTache = 'tous' | 'incomplet' | 'complet' | TacheInvite;

/** La saisie minimale d'une nouvelle fiche, avant de detailler. */
interface BrouillonInvite {
  prenom: string;
  nom: string;
  participantId: string;
  personneTypeId: string;
  categoriePaiementId: string;
}

/**
 * La base d'invites, en tableau. Les reponses du formulaire arrivent en
 * propositions a valider ; les fiches validees tiennent une ligne chacune,
 * la creation passe par une modale et le detail complet par le panneau
 * lateral. Les filtres remplacent les onglets par co-organisateur.
 */
@Component({
  selector: 'app-section-utilisateurs',
  imports: [Modale, Panneau, ValidationFiche],
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
  protected readonly libelleServices = libelleServices;
  protected readonly libelleGoodies = libelleGoodies;
  protected readonly taches = TACHES_INVITE;
  protected readonly neBoitPas = neBoitPas;

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
  protected readonly filtreTache = signal<FiltreTache>('tous');

  protected readonly filtresActifs = computed(
    () =>
      this.filtreParticipant() !== '' ||
      this.filtreProfil() !== '' ||
      this.filtreTache() !== 'tous',
  );

  /** Ou en est chaque fiche : calcule une fois, lu par le tableau et les filtres. */
  protected readonly etatDe = computed(() => {
    const categories = this.store.categoriesPaiement();
    return new Map(this.store.invitesNommes().map((x) => [x.id, etatTaches(x, categories)]));
  });

  protected readonly invitesFiltres = computed(() => {
    const participant = this.filtreParticipant();
    const profil = this.filtreProfil();
    const tache = this.filtreTache();
    const etats = this.etatDe();

    return this.store.invitesNommes().filter((invite) => {
      if (participant && invite.participantId !== participant) return false;
      if (profil === 'sans' && invite.personneTypeId) return false;
      if (profil === 'avec' && !invite.personneTypeId) return false;

      const etat = etats.get(invite.id);
      if (!etat || tache === 'tous') return true;
      if (tache === 'incomplet') return etat.faites < TACHES_INVITE.length;
      if (tache === 'complet') return etat.faites === TACHES_INVITE.length;
      // Un filtre par tache montre celles qui restent a faire, pas les faites.
      return !etat[tache];
    });
  });

  protected reinitialiserFiltres(): void {
    this.filtreParticipant.set('');
    this.filtreProfil.set('');
    this.filtreTache.set('tous');
  }

  /** Combien de fiches attendent encore chaque tache : le compteur du filtre. */
  protected readonly restantParTache = computed(() => {
    const restants: Record<string, number> = { incomplet: 0, complet: 0 };
    for (const etat of this.etatDe().values()) {
      for (const tache of TACHES_INVITE) {
        if (!etat[tache.id]) restants[tache.id] = (restants[tache.id] ?? 0) + 1;
      }
      if (etat.faites === TACHES_INVITE.length) restants['complet'] += 1;
      else restants['incomplet'] += 1;
    }
    return restants;
  });

  protected tachesFaites(invite: Invite): number {
    return this.etatDe().get(invite.id)?.faites ?? 0;
  }

  protected tacheFaite(invite: Invite, tache: TacheInvite): boolean {
    return this.etatDe().get(invite.id)?.[tache] ?? false;
  }

  protected readonly totalTaches = TACHES_INVITE.length;

  /**
   * Les fiches qui attendent encore un profil alcool. Les non-buveurs n'en
   * font pas partie : leur profil vide est une reponse.
   */
  protected readonly sansProfil = computed(
    () => this.store.invitesNommes().filter((x) => !x.personneTypeId && !neBoitPas(x)).length,
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

  /** « 2 bieres, 1 rhum coca par jour » : sa consommation validee. */
  protected consommationDe(invite: Invite): string {
    const profil = this.store.personnesTypes().find((x) => x.id === invite.personneTypeId);
    if (!profil || profil.consommation.length === 0) return '';
    const total = profil.consommation.reduce((somme, x) => somme + x.verresParJour, 0);
    return `${fmtNombre(total)} verre(s) / jour`;
  }

  /** Ce que la personne a coche au formulaire. */
  protected boissonsBues(invite: Invite): string[] {
    return boissonsBues(invite.boissonsAimees);
  }

  protected nomDuProfil(personneTypeId: string): string {
    const type = this.store.personnesTypes().find((x) => x.id === personneTypeId);
    return type ? `${type.emoji} ${type.nom}` : '';
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

  /**
   * Le co-organisateur coche par l'invite au formulaire fait foi : c'est lui
   * qui sait qui il a invite. On ne retombe sur un choix manuel que pour les
   * vieilles reponses, saisies avant que la question existe.
   */
  protected porteurDe(reponse: ReponseFormulaire): string {
    const choisi = this.porteursChoisis().get(reponse.id);
    if (choisi) return choisi;
    const declare = this.store.participants().find((x) => x.id === reponse.invitParId);
    return declare?.id ?? this.porteurParDefaut();
  }

  /** La fiche ouverte dans la modale de relecture, s'il y en a une. */
  protected readonly ficheAValider = signal<ReponseFormulaire | undefined>(undefined);

  protected examiner(reponse: ReponseFormulaire): void {
    this.ficheAValider.set(reponse);
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

  // -- Creation : une modale centree, la saisie minimale --------------------

  protected readonly creationOuverte = signal(false);
  protected readonly brouillon = signal<BrouillonInvite>({
    prenom: '',
    nom: '',
    participantId: '',
    personneTypeId: '',
    categoriePaiementId: '',
  });

  protected readonly creationInvalide = computed(() => this.brouillon().prenom.trim() === '');

  protected ouvrirCreation(): void {
    this.brouillon.set({
      prenom: '',
      nom: '',
      participantId: this.filtreParticipant() || this.porteurParDefaut(),
      personneTypeId: this.filtreProfil() === 'sans' ? '' : this.filtreProfil(),
      categoriePaiementId: '',
    });
    this.creationOuverte.set(true);
  }

  protected majBrouillon(patch: Partial<BrouillonInvite>): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected creer(): void {
    const brouillon = this.brouillon();
    if (!brouillon.prenom.trim() || !brouillon.participantId) return;
    const id = this.store.ajouterInvite(brouillon.participantId);
    this.store.majInvite(id, {
      prenom: brouillon.prenom.trim(),
      nom: brouillon.nom.trim(),
      personneTypeId: brouillon.personneTypeId,
      categoriePaiementId: brouillon.categoriePaiementId,
    });
    this.creationOuverte.set(false);
    // La fiche neuve s'ouvre dans le panneau : le reste s'y remplit.
    this.detailId.set(id);
  }

  // -- Detail : le panneau lateral -----------------------------------------

  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.store.invitesNommes().find((x) => x.id === this.detailId()),
  );

  protected ouvrirDetail(invite: Invite): void {
    this.detailId.set(invite.id);
  }

  protected maj(invite: Invite, patch: Partial<Omit<Invite, 'id'>>): void {
    this.store.majInvite(invite.id, patch);
  }

  protected majMontantPaye(invite: Invite, valeur: string): void {
    const montant = Number(valeur);
    if (Number.isFinite(montant)) {
      this.store.majInvite(invite.id, { montantPaye: Math.max(0, montant) });
    }
  }

  // -- Jours sur place : tous les jours, ou des dates precises --------------

  /** Les jours de l'evenement, avec leur date reelle quand elle est calee. */
  protected readonly joursEvenement = computed(() => {
    const debut = this.store.infos().debut;
    const format = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });
    return tousLesJours(this.store.partage().jours).map((jour) => {
      const date = dateDuJour(debut, jour);
      return { jour, libelle: date ? format.format(date) : `Jour ${jour}` };
    });
  });

  protected presentLe(invite: Invite, jour: number): boolean {
    return invite.joursPresents.includes(jour);
  }

  protected estLaTousLesJours(invite: Invite): boolean {
    return presenceComplete(invite, this.store.partage().jours);
  }

  protected marquerTousLesJours(invite: Invite): void {
    this.store.majInvite(invite.id, { joursPresents: tousLesJours(this.store.partage().jours) });
  }

  protected basculerJour(invite: Invite, jour: number): void {
    const presents = new Set(invite.joursPresents);
    if (presents.has(jour)) presents.delete(jour);
    else presents.add(jour);
    this.store.majInvite(invite.id, { joursPresents: [...presents].sort((a, b) => a - b) });
  }

  /** « Tous les jours », « ven. 21, sam. 22 » ou « — » : la presence en clair. */
  protected libellePresence(invite: Invite): string {
    if (invite.joursPresents.length === 0) return '';
    if (this.estLaTousLesJours(invite)) return 'Tous les jours';
    const parJour = new Map(this.joursEvenement().map((x) => [x.jour, x.libelle]));
    return invite.joursPresents.map((jour) => parJour.get(jour) ?? `J${jour}`).join(', ');
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
    if (confirm(`Retirer ${nom} de la liste ?`)) {
      this.store.supprimerInvite(invite.id);
      if (this.detailId() === invite.id) this.detailId.set('');
    }
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

  // -- Categories de paiement : tableau, modale, panneau --------------------

  protected readonly tarifCreationOuverte = signal(false);
  protected readonly brouillonTarif = signal({ nom: '', montant: 0 });
  protected readonly tarifDetailId = signal('');

  protected readonly tarifDetail = computed(() =>
    this.store.categoriesPaiement().find((x) => x.id === this.tarifDetailId()),
  );

  protected readonly tarifInvalide = computed(() => this.brouillonTarif().nom.trim() === '');

  protected ouvrirCreationTarif(): void {
    this.brouillonTarif.set({ nom: '', montant: 0 });
    this.tarifCreationOuverte.set(true);
  }

  protected majBrouillonTarif(patch: Partial<{ nom: string; montant: number }>): void {
    this.brouillonTarif.set({ ...this.brouillonTarif(), ...patch });
  }

  protected creerTarif(): void {
    const brouillon = this.brouillonTarif();
    if (!brouillon.nom.trim()) return;
    const id = this.store.ajouterCategoriePaiement();
    this.store.majCategoriePaiement(id, {
      nom: brouillon.nom.trim(),
      montant: Math.max(0, brouillon.montant),
    });
    this.tarifCreationOuverte.set(false);
  }

  /** Combien d'invites portent ce tarif, et combien l'ont deja regle. */
  protected usageTarif(categorieId: string): { total: number; payes: number } {
    const concernes = this.store
      .invitesNommes()
      .filter((x) => x.categoriePaiementId === categorieId);
    return { total: concernes.length, payes: concernes.filter((x) => x.paye).length };
  }

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
      if (this.tarifDetailId() === categorie.id) this.tarifDetailId.set('');
    }
  }
}
