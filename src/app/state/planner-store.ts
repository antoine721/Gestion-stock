import { Injectable, computed, inject, signal } from '@angular/core';
import { BOISSON_PAR_ID, PRODUIT_PAR_ID } from '../domain/catalogue';
import {
  EntreeCalcul,
  MATERIEL_PAR_DEFAUT,
  buveursDe,
  calculerPanier,
  consoliderCadre,
  consommationDe,
  invitesDe,
  repartirCout,
  resumerPersonnesTypes,
} from '../domain/calcul';
import { personneTypeVierge, personnesTypesInitiales } from '../domain/personnes-types';
import { PROFILS, calculerAlertes, calculerRatios } from '../domain/validation';
import { effectifsAvecInvites, inviteVierge, invitesNommesDe } from '../domain/invites';
import {
  budgetNourriture,
  extraNourritureVierge,
  repasPour,
  repasVierge,
} from '../domain/nourriture';
import { articleVierge, budgetMateriel } from '../domain/materiel-liste';
import { budgetGlobal, repartitionGlobale } from '../domain/stats';
import {
  Ajustement,
  Article,
  Cibles,
  Effectif,
  ExtraNourriture,
  Invite,
  Materiel,
  MomentRepas,
  Override,
  Partage,
  Participant,
  PersonneType,
  Profil,
  Repas,
  ReponseFormulaire,
} from '../domain/models';
import { Api, EvenementDistant } from './api';

/** Onglet ouvert : un co-organisateur, ou la vue consolidee de l'evenement. */
export type Onglet = string;
export const ONGLET_EVENEMENT = 'evenement';

/** Sections de l'onglet Evenement. */
export type Section = 'courses' | 'profils' | 'extras' | 'reglages' | 'bilan';

export const SECTIONS: readonly { id: Section; libelle: string }[] = [
  { id: 'courses', libelle: 'Liste de courses' },
  { id: 'profils', libelle: 'Les profils' },
  { id: 'extras', libelle: 'Extras' },
  { id: 'bilan', libelle: 'Bilan' },
  { id: 'reglages', libelle: 'Reglages' },
];

/** Les grandes pieces du hub, servies par la sidebar. */
export type Espace =
  'accueil' | 'alcool' | 'nourriture' | 'utilisateurs' | 'materiel' | 'stats' | 'formulaire';

export const ESPACES: readonly {
  id: Espace;
  libelle: string;
  emoji: string;
  /** Teinte de la card et de la nav : chaque piece a sa couleur. */
  teinte: string;
}[] = [
  { id: 'accueil', libelle: 'Accueil', emoji: '🏠', teinte: 'ardoise' },
  { id: 'alcool', libelle: 'Bar & boissons', emoji: '🍹', teinte: 'petrole' },
  { id: 'nourriture', libelle: 'Nourriture', emoji: '🍽️', teinte: 'orange' },
  { id: 'utilisateurs', libelle: 'Invites', emoji: '🧑‍🤝‍🧑', teinte: 'bleu' },
  { id: 'materiel', libelle: 'Materiel', emoji: '🛠️', teinte: 'violet' },
  { id: 'stats', libelle: 'Stats & budget', emoji: '📊', teinte: 'vert' },
  { id: 'formulaire', libelle: 'Formulaire', emoji: '📝', teinte: 'rose' },
];

export const PARTAGE_INITIAL: Partage = {
  nom: 'Ma soiree',
  jours: 1,
  profil: 'normal',
  cibles: PROFILS['normal'],
  personnesTypes: [],
  formats: [],
  overrides: [],
  ajustements: [],
  materiel: MATERIEL_PAR_DEFAUT,
  invites: [],
  nourriture: { repas: [], extras: [] },
  articles: [],
  reponsesFormulaire: [],
};

/** Bibliotheque de depart, posee a la creation de l'evenement. */
export function partageInitial(creeParNom: string): Partage {
  return { ...PARTAGE_INITIAL, personnesTypes: personnesTypesInitiales(creeParNom, identifiant) };
}

let compteur = 0;
function identifiant(): string {
  compteur += 1;
  return `pt${Date.now().toString(36)}${compteur.toString(36)}`;
}

const DELAI_SAUVEGARDE = 700;
const DELAI_RAFRAICHISSEMENT = 8000;

/**
 * Tout l'etat de l'evenement. Le catalogue reste statique ; seules les saisies
 * (reglages communs et participants) vivent en base, pour que les trois
 * co-organisateurs voient la meme chose.
 */
@Injectable({ providedIn: 'root' })
export class PlannerStore {
  private readonly api = inject(Api);

  readonly code = signal('');
  readonly partage = signal<Partage>(PARTAGE_INITIAL);
  readonly participants = signal<readonly Participant[]>([]);
  readonly onglet = signal<Onglet>(ONGLET_EVENEMENT);
  readonly section = signal<Section>('courses');
  readonly espace = signal<Espace>('accueil');

  readonly chargement = signal(false);
  readonly erreur = signal('');
  readonly enregistrement = signal(false);

  private minuteurPartage?: ReturnType<typeof setTimeout>;
  private readonly minuteursParticipant = new Map<string, ReturnType<typeof setTimeout>>();
  private rafraichissement?: ReturnType<typeof setInterval>;

  // -- Lectures derivees ---------------------------------------------------

  /** Mon identifiant de participant dans CET evenement. */
  readonly moiId = signal('');

  readonly moi = computed(() => this.participants().find((x) => x.id === this.moiId()));

  /** Le participant dont l'onglet est ouvert (undefined sur la vue totale). */
  readonly participantEdite = computed(() => {
    const onglet = this.onglet();
    return onglet === ONGLET_EVENEMENT
      ? undefined
      : this.participants().find((x) => x.id === onglet);
  });

  readonly cibles = computed(() => this.partage().cibles);

  /**
   * Les participants vus par le moteur de calcul : leurs effectifs anonymes
   * plus leurs invites nommes, convertis en effectifs. Toute la consolidation
   * passe par cette vue pour qu'une personne nommee compte comme une tete.
   */
  readonly participantsComplets = computed(() => {
    const invites = this.partage().invites;
    return this.participants().map((participant) => ({
      ...participant,
      effectifs: effectifsAvecInvites(
        participant.effectifs,
        invitesNommesDe(invites, participant.id),
      ),
    }));
  });

  readonly cadre = computed(() => consoliderCadre(this.participantsComplets(), this.partage()));

  readonly materiel = computed(() => this.partage().materiel);

  private readonly entree = computed<EntreeCalcul>(() => {
    const partage = this.partage();
    return {
      consommation: consommationDe(
        this.participantsComplets(),
        partage.personnesTypes,
        partage.jours,
      ),
      formats: new Map(partage.formats),
      overrides: new Map(partage.overrides),
      ajustements: new Map(partage.ajustements),
      materiel: partage.materiel,
      jours: partage.jours,
    };
  });

  readonly panier = computed(() => calculerPanier(this.entree()));

  /** La liste calculee : ce qui decoule des profils et des effectifs. */
  readonly lignesCourses = computed(() => this.panier().lignes.filter((x) => !x.plaisir));

  /** Les extras : bouteilles ajoutees a la main, hors calcul par personne. */
  readonly extras = computed(() => this.panier().lignes.filter((x) => x.plaisir));

  readonly ratios = computed(() => calculerRatios(this.cadre(), this.cibles(), this.panier()));

  readonly alertes = computed(() =>
    calculerAlertes(this.cadre(), this.panier(), this.partage().materiel.prixTireuse),
  );

  readonly repartition = computed(() =>
    repartirCout(
      this.participantsComplets(),
      this.personnesTypes(),
      this.entree(),
      this.partage().jours,
    ),
  );

  readonly buveurs = computed(() => {
    const cadre = this.cadre();
    return Math.max(1, Math.round(cadre.invites * cadre.partBuveurs));
  });

  readonly nonBuveurs = computed(() => Math.max(0, this.cadre().invites - this.buveurs()));

  readonly personnesTypes = computed(() => this.partage().personnesTypes);

  /** Ce que chaque profil pese, effectifs et invites nommes compris. */
  readonly resumePersonnesTypes = computed(() =>
    resumerPersonnesTypes(this.participantsComplets(), this.personnesTypes()),
  );

  /** Les effectifs saisis dans l'onglet ouvert. */
  readonly effectifs = computed(() => this.participantEdite()?.effectifs ?? []);

  /** La version fusionnee (effectifs + invites nommes) de l'onglet ouvert. */
  private readonly participantEditeComplet = computed(() => {
    const participant = this.participantEdite();
    return participant
      ? this.participantsComplets().find((x) => x.id === participant.id)
      : undefined;
  });

  readonly invitesDuParticipant = computed(() => {
    const participant = this.participantEditeComplet();
    return participant ? invitesDe(participant) : 0;
  });

  readonly buveursDuParticipant = computed(() => {
    const participant = this.participantEditeComplet();
    return participant ? buveursDe(participant, this.personnesTypes()) : 0;
  });

  readonly lienPartage = computed(() =>
    typeof location === 'undefined' ? '' : `${location.origin}/e/${this.code()}`,
  );

  // -- Lectures des nouvelles pieces du hub --------------------------------

  readonly invitesNommes = computed(() => this.partage().invites);

  readonly nourriture = computed(() => this.partage().nourriture);

  readonly articles = computed(() => this.partage().articles);

  readonly reponsesFormulaire = computed(() => this.partage().reponsesFormulaire);

  readonly budgetNourriture = computed(() =>
    budgetNourriture(this.nourriture(), this.cadre().invites, this.partage().jours),
  );

  readonly budgetMateriel = computed(() => budgetMateriel(this.articles()));

  readonly budgetGlobal = computed(() =>
    budgetGlobal(
      this.panier().coutTotal,
      this.budgetNourriture().total,
      this.budgetMateriel().total,
      this.cadre().invites,
    ),
  );

  readonly repartitionGlobale = computed(() =>
    repartitionGlobale(
      this.repartition(),
      this.budgetNourriture().total,
      this.budgetMateriel().total,
      this.articles(),
    ),
  );

  // -- Cycle de vie --------------------------------------------------------

  async ouvrir(code: string): Promise<void> {
    this.chargement.set(true);
    this.erreur.set('');
    try {
      this.appliquer(await this.api.charger(code));
      this.demarrerRafraichissement();
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Chargement impossible');
      throw erreur;
    } finally {
      this.chargement.set(false);
    }
  }

  fermer(): void {
    if (this.rafraichissement) clearInterval(this.rafraichissement);
    this.rafraichissement = undefined;
  }

  private appliquer(distant: EvenementDistant): void {
    this.code.set(distant.code);
    this.partage.set({ ...PARTAGE_INITIAL, ...distant.partage });
    this.participants.set(
      distant.participants.map((x) => ({
        ...x,
        effectifs: x.effectifs ?? [],
      })),
    );

    const onglet = this.onglet();
    const existe = distant.participants.some((x) => x.id === onglet);
    if (onglet !== ONGLET_EVENEMENT && !existe) this.onglet.set(ONGLET_EVENEMENT);
  }

  /**
   * Recharge en tache de fond pour voir arriver les saisies des autres. Les
   * participants en cours d'edition ici ne sont pas ecrases : leur sauvegarde
   * est encore en vol.
   */
  private demarrerRafraichissement(): void {
    if (this.rafraichissement) clearInterval(this.rafraichissement);
    this.rafraichissement = setInterval(() => void this.rafraichir(), DELAI_RAFRAICHISSEMENT);
  }

  private async rafraichir(): Promise<void> {
    if (!this.code() || this.minuteursParticipant.size > 0 || this.minuteurPartage) return;
    try {
      this.appliquer(await this.api.charger(this.code()));
    } catch {
      // Reseau capricieux : on retentera au prochain tick.
    }
  }

  // -- Reglages communs ----------------------------------------------------

  majPartage(patch: Partial<Partage>): void {
    this.partage.update((partage) => ({ ...partage, ...patch }));
    this.planifierPartage();
  }

  choisirProfil(profil: Profil): void {
    this.majPartage({ profil, cibles: { ...PROFILS[profil] } });
  }

  majCible(patch: Partial<Cibles>): void {
    this.majPartage({ cibles: { ...this.partage().cibles, ...patch } });
  }

  reinitialiserCibles(): void {
    this.majPartage({ cibles: { ...PROFILS[this.partage().profil] } });
  }

  majCadre(patch: { jours?: number }): void {
    if (patch.jours !== undefined) this.majPartage({ jours: Math.max(1, patch.jours) });
  }

  // -- Participants --------------------------------------------------------

  majParticipant(participantId: string, patch: Partial<Omit<Participant, 'id'>>): void {
    this.participants.update((participants) =>
      participants.map((x) => (x.id === participantId ? { ...x, ...patch } : x)),
    );
    this.planifierParticipant(participantId);
  }

  /**
   * Arrivee par le lien partage : valide le mot de passe et rend mon identifiant,
   * en reprenant ma ligne si je m'etais deja declare depuis un autre appareil.
   */
  async rejoindre(code: string, nom: string): Promise<string> {
    const { id } = await this.api.rejoindre(code, nom);
    this.moiId.set(id);
    return id;
  }

  async ajouterParticipant(nom: string): Promise<void> {
    await this.api.rejoindre(this.code(), nom);
    this.appliquer(await this.api.charger(this.code()));
  }

  async retirerParticipant(participantId: string): Promise<void> {
    await this.api.retirerParticipant(this.code(), participantId);
    this.appliquer(await this.api.charger(this.code()));
    // Ses invites nommes partent avec lui, sinon ils ne designent plus personne.
    const orphelins = this.invitesNommes().some((x) => x.participantId === participantId);
    if (orphelins) {
      this.majPartage({
        invites: this.invitesNommes().filter((x) => x.participantId !== participantId),
      });
    }
  }

  // -- Effectifs de l'onglet ouvert ----------------------------------------

  /** Combien de personnes de ce profil j'amene. */
  majEffectif(personneTypeId: string, nombre: number): void {
    const participant = this.participantEdite();
    if (!participant) return;

    const propre = Math.max(0, Math.round(nombre));
    const autres = participant.effectifs.filter((x) => x.personneTypeId !== personneTypeId);
    const effectifs: Effectif[] =
      propre > 0 ? [...autres, { personneTypeId, nombre: propre }] : autres;

    this.majParticipant(participant.id, { effectifs });
  }

  effectifDe(personneTypeId: string): number {
    return this.effectifs().find((x) => x.personneTypeId === personneTypeId)?.nombre ?? 0;
  }

  // -- Bibliotheque de profils (commune) -----------------------------------

  creerPersonneType(): string {
    const id = identifiant();
    const nom = this.moi()?.nom ?? "Quelqu'un";
    this.majPartage({
      personnesTypes: [...this.personnesTypes(), personneTypeVierge(id, nom)],
    });
    return id;
  }

  /** Dupliquer plutot que repartir de zero, quand un profil est presque bon. */
  dupliquerPersonneType(personneTypeId: string): string {
    const modele = this.personnesTypes().find((x) => x.id === personneTypeId);
    if (!modele) return '';
    const id = identifiant();
    this.majPartage({
      personnesTypes: [
        ...this.personnesTypes(),
        {
          ...modele,
          id,
          nom: `${modele.nom} (copie)`,
          creeParNom: this.moi()?.nom ?? modele.creeParNom,
          consommation: modele.consommation.map((x) => ({ ...x })),
        },
      ],
    });
    return id;
  }

  majPersonneType(personneTypeId: string, patch: Partial<Omit<PersonneType, 'id'>>): void {
    this.majPartage({
      personnesTypes: this.personnesTypes().map((x) =>
        x.id === personneTypeId ? { ...x, ...patch } : x,
      ),
    });
  }

  /** Regle la consommation d'une boisson pour un profil ; 0 la retire. */
  majConsommation(personneTypeId: string, boissonId: string, verresParJour: number): void {
    const type = this.personnesTypes().find((x) => x.id === personneTypeId);
    if (!type || !BOISSON_PAR_ID.has(boissonId)) return;

    const valeur = Math.max(0, verresParJour);
    const autres = type.consommation.filter((x) => x.boissonId !== boissonId);
    this.majPersonneType(personneTypeId, {
      consommation: valeur > 0 ? [...autres, { boissonId, verresParJour: valeur }] : autres,
    });
  }

  /**
   * Supprimer un profil retire aussi les effectifs qui le visaient, sinon ils
   * resteraient dans les participants sans rien designer.
   */
  supprimerPersonneType(personneTypeId: string): void {
    this.majPartage({
      personnesTypes: this.personnesTypes().filter((x) => x.id !== personneTypeId),
      // Les invites nommes qui portaient ce profil redeviennent « sans profil ».
      invites: this.invitesNommes().map((x) =>
        x.personneTypeId === personneTypeId ? { ...x, personneTypeId: '' } : x,
      ),
    });
    for (const participant of this.participants()) {
      if (participant.effectifs.some((x) => x.personneTypeId === personneTypeId)) {
        this.majParticipant(participant.id, {
          effectifs: participant.effectifs.filter((x) => x.personneTypeId !== personneTypeId),
        });
      }
    }
  }

  // -- Conditionnement, prix, materiel (communs) ---------------------------

  choisirFormat(formatId: string, produitId: string): void {
    const formats = new Map(this.partage().formats).set(formatId, produitId);
    this.majPartage({ formats: [...formats] });
  }

  majPrix(produitId: string, prixEur: number): void {
    this.majOverride(produitId, { prixEur: Math.max(0, prixEur) });
  }

  majContenance(produitId: string, contenanceMl: number): void {
    this.majOverride(produitId, { contenanceMl: Math.max(1, Math.round(contenanceMl)) });
  }

  reinitialiserProduit(produitId: string): void {
    const overrides = new Map(this.partage().overrides);
    overrides.delete(produitId);
    this.majPartage({ overrides: [...overrides] });
  }

  estModifie(produitId: string): boolean {
    return this.partage().overrides.some(([id]) => id === produitId);
  }

  private majOverride(produitId: string, patch: Override): void {
    const overrides = new Map(this.partage().overrides);
    overrides.set(produitId, { ...(overrides.get(produitId) ?? {}), ...patch });
    this.majPartage({ overrides: [...overrides] });
  }

  majPrixTireuse(prixTireuse: number): void {
    this.majPartage({ materiel: { prixTireuse: Math.max(0, prixTireuse) } });
  }

  // -- Liste de courses (commune) ------------------------------------------

  /**
   * Les extras sont des bouteilles achetees en quantite fixe, hors calcul par
   * personne : on n'en prendra qu'une ou deux quoi qu'il arrive.
   */
  ajouterExtra(produitId: string, bouteilles = 1): void {
    if (!PRODUIT_PAR_ID.has(produitId)) return;
    this.majAjustement(produitId, () => ({
      plaisir: true,
      strategie: { type: 'forfait', bouteilles: Math.max(1, Math.round(bouteilles)) },
    }));
  }

  majQuantiteExtra(produitId: string, bouteilles: number): void {
    const nombre = Math.max(0, Math.round(bouteilles));
    if (nombre === 0) return this.retirerExtra(produitId);
    this.majAjustement(produitId, () => ({
      plaisir: true,
      strategie: { type: 'forfait', bouteilles: nombre },
    }));
  }

  retirerExtra(produitId: string): void {
    this.majAjustement(produitId, () => ({ plaisir: false, strategie: { type: 'auto' } }));
  }

  forcerQuantite(produitId: string, bouteilles: number): void {
    this.majAjustement(produitId, (x) => ({
      ...x,
      strategie: { type: 'forfait', bouteilles: Math.max(0, Math.round(bouteilles)) },
    }));
  }

  libererQuantite(produitId: string): void {
    this.majAjustement(produitId, (x) => ({ ...x, strategie: { type: 'auto' } }));
  }

  private majAjustement(produitId: string, patch: (x: Ajustement) => Ajustement): void {
    const ajustements = new Map(this.partage().ajustements);
    const suivant = patch(
      ajustements.get(produitId) ?? { plaisir: false, strategie: { type: 'auto' } },
    );
    if (!suivant.plaisir && suivant.strategie.type === 'auto') ajustements.delete(produitId);
    else ajustements.set(produitId, suivant);
    this.majPartage({ ajustements: [...ajustements] });
  }

  // -- Invites nommes ------------------------------------------------------

  ajouterInvite(participantId: string): string {
    const id = identifiant();
    this.majPartage({ invites: [...this.invitesNommes(), inviteVierge(id, participantId)] });
    return id;
  }

  majInvite(inviteId: string, patch: Partial<Omit<Invite, 'id'>>): void {
    this.majPartage({
      invites: this.invitesNommes().map((x) => (x.id === inviteId ? { ...x, ...patch } : x)),
    });
  }

  supprimerInvite(inviteId: string): void {
    this.majPartage({ invites: this.invitesNommes().filter((x) => x.id !== inviteId) });
  }

  // -- Nourriture ----------------------------------------------------------

  /** Cree ou complete le repas d'une case jour x moment. */
  definirRepas(jour: number, moment: MomentRepas, patch: Partial<Omit<Repas, 'id'>>): void {
    const nourriture = this.nourriture();
    const existant = repasPour(nourriture, jour, moment);
    const repas = existant
      ? nourriture.repas.map((x) => (x.id === existant.id ? { ...x, ...patch } : x))
      : [...nourriture.repas, { ...repasVierge(identifiant(), jour, moment), ...patch }];
    this.majPartage({ nourriture: { ...nourriture, repas } });
  }

  supprimerRepas(repasId: string): void {
    const nourriture = this.nourriture();
    this.majPartage({
      nourriture: { ...nourriture, repas: nourriture.repas.filter((x) => x.id !== repasId) },
    });
  }

  ajouterExtraNourriture(): string {
    const id = identifiant();
    const nourriture = this.nourriture();
    this.majPartage({
      nourriture: { ...nourriture, extras: [...nourriture.extras, extraNourritureVierge(id)] },
    });
    return id;
  }

  majExtraNourriture(extraId: string, patch: Partial<Omit<ExtraNourriture, 'id'>>): void {
    const nourriture = this.nourriture();
    this.majPartage({
      nourriture: {
        ...nourriture,
        extras: nourriture.extras.map((x) => (x.id === extraId ? { ...x, ...patch } : x)),
      },
    });
  }

  supprimerExtraNourriture(extraId: string): void {
    const nourriture = this.nourriture();
    this.majPartage({
      nourriture: { ...nourriture, extras: nourriture.extras.filter((x) => x.id !== extraId) },
    });
  }

  // -- Materiel : location et achat ----------------------------------------

  ajouterArticle(modele: Partial<Omit<Article, 'id'>> = {}): string {
    const id = identifiant();
    this.majPartage({ articles: [...this.articles(), { ...articleVierge(id), ...modele }] });
    return id;
  }

  majArticle(articleId: string, patch: Partial<Omit<Article, 'id'>>): void {
    this.majPartage({
      articles: this.articles().map((x) => (x.id === articleId ? { ...x, ...patch } : x)),
    });
  }

  supprimerArticle(articleId: string): void {
    this.majPartage({ articles: this.articles().filter((x) => x.id !== articleId) });
  }

  // -- Formulaire invite ---------------------------------------------------

  ajouterReponse(reponse: Omit<ReponseFormulaire, 'id' | 'creeLe'>): string {
    const id = identifiant();
    this.majPartage({
      reponsesFormulaire: [
        ...this.reponsesFormulaire(),
        { ...reponse, id, creeLe: new Date().toISOString() },
      ],
    });
    return id;
  }

  supprimerReponse(reponseId: string): void {
    this.majPartage({
      reponsesFormulaire: this.reponsesFormulaire().filter((x) => x.id !== reponseId),
    });
  }

  /**
   * Transforme une reponse de formulaire en invite nomme rattache a un
   * co-organisateur : le formulaire alimente la liste, il ne la remplace pas.
   */
  importerReponse(reponseId: string, participantId: string): void {
    const reponse = this.reponsesFormulaire().find((x) => x.id === reponseId);
    if (!reponse) return;

    const remarques = [reponse.preferencesBoissons, reponse.recommandations, reponse.commentaire]
      .filter((x) => x.trim().length > 0)
      .join(' · ');

    this.majPartage({
      invites: [
        ...this.invitesNommes(),
        {
          ...inviteVierge(identifiant(), participantId),
          prenom: reponse.prenom,
          nom: reponse.nom,
          regime: reponse.regime,
          allergies: reponse.allergies,
          envies: reponse.envies,
          remarques,
        },
      ],
      reponsesFormulaire: this.reponsesFormulaire().filter((x) => x.id !== reponseId),
    });
  }

  // -- Sauvegarde differee -------------------------------------------------

  private planifierPartage(): void {
    if (this.minuteurPartage) clearTimeout(this.minuteurPartage);
    this.minuteurPartage = setTimeout(() => void this.enregistrerPartage(), DELAI_SAUVEGARDE);
  }

  private planifierParticipant(participantId: string): void {
    const minuteur = this.minuteursParticipant.get(participantId);
    if (minuteur) clearTimeout(minuteur);
    this.minuteursParticipant.set(
      participantId,
      setTimeout(() => void this.enregistrerParticipant(participantId), DELAI_SAUVEGARDE),
    );
  }

  private async enregistrerPartage(): Promise<void> {
    this.minuteurPartage = undefined;
    if (!this.code()) return;
    this.enregistrement.set(true);
    try {
      await this.api.enregistrerPartage(this.code(), this.partage());
      this.erreur.set('');
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Sauvegarde impossible');
    } finally {
      this.enregistrement.set(false);
    }
  }

  private async enregistrerParticipant(participantId: string): Promise<void> {
    this.minuteursParticipant.delete(participantId);
    const participant = this.participants().find((x) => x.id === participantId);
    if (!this.code() || !participant) return;

    this.enregistrement.set(true);
    try {
      await this.api.enregistrerParticipant(this.code(), participant);
      this.erreur.set('');
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Sauvegarde impossible');
    } finally {
      this.enregistrement.set(false);
    }
  }
}
