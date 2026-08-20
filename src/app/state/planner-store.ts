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
} from '../domain/calcul';
import { personneTypeVierge } from '../domain/personnes-types';
import { PROFILS, calculerAlertes, calculerRatios } from '../domain/validation';
import {
  calculerEncaissements,
  effectifsAvecInvites,
  inviteVierge,
  invitesNommesDe,
  logistiqueVierge,
  niveauxVierges,
  normaliserInvite,
  resumerLogistique,
  tousLesJours,
} from '../domain/invites';
import { normaliserGouts, resumerGoodies } from '../domain/preferences';
import {
  budgetNourriture,
  coursesCuisine,
  extraNourritureVierge,
  ingredientVierge,
  normaliserRepas,
  repasPour,
  repasVierge,
} from '../domain/nourriture';
import { infosVierges } from '../domain/evenement';
import { articleVierge, budgetMateriel, normaliserArticle } from '../domain/materiel-liste';
import { budgetGlobal, repartitionGlobale } from '../domain/stats';
import { listeCoursesUnifiee, normaliserArticleCourse, resumerCourses } from '../domain/courses';
import { repartirParCategorie } from '../domain/categories-courses';
import {
  creneauVierge,
  demandesMusicales,
  djSetVierge,
  normaliserCreneau,
  personnesAssignables,
  resumerDj,
  resumerProgramme,
  volontaires,
} from '../domain/programme';
import {
  Ajustement,
  Article,
  ArticleCourse,
  CategoriePaiement,
  Cibles,
  ConsommationType,
  Creneau,
  DjSet,
  ExtraNourriture,
  IngredientRepas,
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

/** Sections de l'espace Bar & boissons. */
export type Section = 'courses' | 'interpretation' | 'extras' | 'reglages' | 'bilan';

export const SECTIONS: readonly { id: Section; libelle: string }[] = [
  { id: 'courses', libelle: 'Liste de courses' },
  { id: 'interpretation', libelle: 'Les consommations' },
  { id: 'extras', libelle: 'Extras' },
  { id: 'bilan', libelle: 'Bilan' },
  { id: 'reglages', libelle: 'Reglages' },
];

/** Les grandes pieces du hub, servies par la sidebar. */
export type Espace =
  | 'accueil'
  | 'profil'
  | 'alcool'
  | 'nourriture'
  | 'utilisateurs'
  | 'materiel'
  | 'courses'
  | 'programme'
  | 'dj'
  | 'stats'
  | 'formulaire';

export const ESPACES: readonly {
  id: Espace;
  libelle: string;
  emoji: string;
  /** Teinte de la card et de la nav : chaque piece a sa couleur. */
  teinte: string;
}[] = [
  { id: 'accueil', libelle: 'Accueil', emoji: '🏠', teinte: 'ardoise' },
  { id: 'profil', libelle: 'Profil', emoji: '🎪', teinte: 'ardoise' },
  { id: 'alcool', libelle: 'Bar & boissons', emoji: '🍹', teinte: 'petrole' },
  { id: 'nourriture', libelle: 'Nourriture', emoji: '🍽️', teinte: 'orange' },
  { id: 'utilisateurs', libelle: 'Invites', emoji: '🧑‍🤝‍🧑', teinte: 'bleu' },
  { id: 'materiel', libelle: 'Materiel', emoji: '🛠️', teinte: 'violet' },
  { id: 'courses', libelle: 'Courses', emoji: '🛒', teinte: 'olive' },
  { id: 'programme', libelle: 'Programme', emoji: '📅', teinte: 'indigo' },
  { id: 'dj', libelle: 'DJ', emoji: '🎧', teinte: 'fuchsia' },
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
  categoriesPaiement: [],
  coursesCochees: [],
  coursesLibres: [],
  programme: { creneaux: [], tracklist: [] },
  djSets: [],
  infos: infosVierges(),
};

/**
 * L'etat d'un evenement qui vient de naitre : vide. Rien n'est pre-rempli —
 * ni profils de consommation, ni repas, ni materiel. Ce qui est deja
 * enregistre sur un evenement existant n'est evidemment pas touche.
 */
export function partageInitial(_creeParNom: string): Partage {
  return { ...PARTAGE_INITIAL };
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
  readonly section = signal<Section>('courses');
  readonly espace = signal<Espace>('accueil');

  /** Le fil d'Ariane du hub : d'ou l'on vient, pour le bouton retour du menu. */
  private readonly historique = signal<readonly Espace[]>([]);
  readonly peutRevenir = computed(() => this.historique().length > 0);

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

  readonly lienPartage = computed(() =>
    typeof location === 'undefined' ? '' : `${location.origin}/e/${this.code()}`,
  );

  /** Le lien public de la fiche invite : le seul qui se donne sans mot de passe. */
  readonly lienFormulaire = computed(() =>
    typeof location === 'undefined' ? '' : `${location.origin}/f/${this.code()}`,
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

  readonly categoriesPaiement = computed(() => this.partage().categoriesPaiement);

  readonly encaissements = computed(() =>
    calculerEncaissements(this.invitesNommes(), this.categoriesPaiement()),
  );

  /** Le besoin cuisine agrege, converti en paquets une seule fois. */
  readonly lignesCuisine = computed(() =>
    coursesCuisine(this.nourriture(), this.cadre().invites, this.partage().jours),
  );

  /** Ce qu'on a pose a la main dans le rayon. */
  readonly coursesLibres = computed(() => this.partage().coursesLibres);

  /** La liste unifiee : bar + cuisine + grignotage + rayon + materiel. */
  readonly listeCourses = computed(() =>
    listeCoursesUnifiee(
      this.panier().lignes,
      this.lignesCuisine(),
      this.nourriture().extras,
      this.articles(),
      this.coursesLibres(),
      new Set(this.partage().coursesCochees),
    ),
  );

  /**
   * Les diluants : ce que les recettes reclament, face a ce qu'on a deja mis
   * au caddie. Le moteur n'achete pas les diluants — le format et la marque se
   * decident devant le rayon — mais il sait qu'il faut 12 L de coca pour les
   * rhum-cocas prevus, et c'est ce qu'on met sous les yeux.
   */
  readonly diluants = computed(() => {
    const panier = this.panier();
    const auCaddie = new Map(panier.lignes.map((x) => [x.produit.id, x]));

    const reclames = panier.besoinsDiluants.map((besoin) => {
      const ligne = auCaddie.get(besoin.produit.id);
      const bouteilles = ligne?.bouteilles ?? 0;
      const volume = bouteilles * besoin.produit.contenanceMl;
      return {
        produit: besoin.produit,
        besoinMl: besoin.mlAvecMarge,
        conseille: besoin.bouteilles,
        boissons: besoin.boissons,
        bouteilles,
        volume,
        prix: ligne?.prixTotal ?? 0,
        couverture: besoin.mlAvecMarge > 0 ? volume / besoin.mlAvecMarge : 1,
        manque: Math.max(0, besoin.bouteilles - bouteilles),
      };
    });

    // Ceux qu'on a choisis sans qu'aucune recette ne les reclame : le jus de
    // pomme pris pour les enfants a autant sa place dans le caddie.
    const reclamesIds = new Set(reclames.map((x) => x.produit.id));
    const libres = panier.lignes
      .filter((x) => x.produit.categorie === 'soft' && !reclamesIds.has(x.produit.id))
      .map((ligne) => ({
        produit: ligne.produit,
        besoinMl: 0,
        conseille: 0,
        boissons: [] as string[],
        bouteilles: ligne.bouteilles,
        volume: ligne.bouteilles * ligne.produit.contenanceMl,
        prix: ligne.prixTotal,
        couverture: 1,
        manque: 0,
      }));

    const besoinTotal = reclames.reduce((somme, x) => somme + x.besoinMl, 0);
    const volumeTotal = [...reclames, ...libres].reduce((somme, x) => somme + x.volume, 0);
    return {
      lignes: [...reclames, ...libres],
      besoinTotal,
      volumeTotal,
      prixTotal: [...reclames, ...libres].reduce((somme, x) => somme + x.prix, 0),
      // Sans besoin, il n'y a rien a couvrir : la jauge est pleine, pas vide.
      couverture: besoinTotal > 0 ? volumeTotal / besoinTotal : 1,
      manque: Math.max(0, besoinTotal - volumeTotal),
    };
  });

  readonly resumeCourses = computed(() => resumerCourses(this.listeCourses()));

  /** Le total des courses rayon par rayon : les parts du camembert. */
  readonly repartitionCourses = computed(() => repartirParCategorie(this.listeCourses()));

  readonly programme = computed(() => this.partage().programme);

  readonly resumeProgramme = computed(() =>
    resumerProgramme(this.programme(), this.partage().jours),
  );

  /** Les envies musicales du formulaire et des fiches, pour nourrir les DJ. */
  readonly demandesMusicales = computed(() =>
    demandesMusicales(this.reponsesFormulaire(), this.invitesNommes(), this.programme().tracklist),
  );

  /** Tout le monde participe : le vivier des missions et des sets. */
  readonly personnesAssignables = computed(() =>
    personnesAssignables(this.participants(), this.invitesNommes()),
  );

  readonly djSets = computed(() => this.partage().djSets);

  readonly resumeDj = computed(() => resumerDj(this.djSets()));

  /** Les invites qui veulent faire quelque chose : DJ, jeux, animation... */
  readonly volontaires = computed(() => volontaires(this.invitesNommes()));

  /** Covoiturage, couchage, materiel prete : la logistique d'un coup d'oeil. */
  readonly resumeLogistique = computed(() => resumerLogistique(this.invitesNommes()));

  /**
   * L'envie de goodies, fiches validees et reponses en attente confondues :
   * on commande sur la demande totale, pas sur ce qui a deja ete valide.
   */
  readonly resumeGoodies = computed(() =>
    resumerGoodies([...this.invitesNommes(), ...this.reponsesFormulaire()]),
  );

  /** Les goodies suggeres a la main, qui ne sont dans aucune liste. */
  readonly suggestionsGoodies = computed(() =>
    [...this.invitesNommes(), ...this.reponsesFormulaire()]
      .filter((x) => x.goodiesAutre.trim().length > 0)
      .map((x) => ({ qui: x.prenom, quoi: x.goodiesAutre.trim() })),
  );

  /** Les effectifs anonymes herites de l'ancienne saisie par profil. */
  readonly effectifsAnonymes = computed(() =>
    this.participants().reduce(
      (somme, participant) =>
        somme + participant.effectifs.reduce((x, y) => x + Math.max(0, y.nombre), 0),
      0,
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

  /** Toute navigation entre espaces passe par ici : le retour sait d'ou l'on vient. */
  allerA(espace: Espace): void {
    if (espace === this.espace()) return;
    this.historique.update((x) => [...x.slice(-19), this.espace()]);
    this.espace.set(espace);
  }

  retour(): void {
    const precedent = this.historique().at(-1);
    if (precedent === undefined) return;
    this.historique.update((x) => x.slice(0, -1));
    this.espace.set(precedent);
  }

  fermer(): void {
    if (this.rafraichissement) clearInterval(this.rafraichissement);
    this.rafraichissement = undefined;
    this.historique.set([]);
  }

  private appliquer(distant: EvenementDistant): void {
    this.code.set(distant.code);
    // Les evenements anterieurs aux nouveaux champs restent lisibles : chaque
    // objet imbrique est complete avec ses valeurs par defaut.
    const partage = { ...PARTAGE_INITIAL, ...distant.partage };
    this.partage.set({
      ...partage,
      invites: partage.invites.map((x) => normaliserInvite(x)),
      nourriture: {
        repas: (partage.nourriture.repas ?? []).map((x) => normaliserRepas(x)),
        extras: partage.nourriture.extras ?? [],
      },
      programme: {
        creneaux: (partage.programme.creneaux ?? []).map((x) => normaliserCreneau(x)),
        tracklist: partage.programme.tracklist ?? [],
      },
      djSets: partage.djSets ?? [],
      articles: (partage.articles ?? []).map((x) => normaliserArticle(x)),
      coursesLibres: (partage.coursesLibres ?? []).map((x) => normaliserArticleCourse(x)),
      infos: { ...infosVierges(), ...partage.infos },
      reponsesFormulaire: partage.reponsesFormulaire.map((x) => ({
        ...x,
        invitParId: x.invitParId ?? '',
        stylesMusicaux: x.stylesMusicaux ?? '',
        logistique: { ...logistiqueVierge(), ...x.logistique },
        surnom: x.surnom ?? '',
        telephone: x.telephone ?? '',
        boissonsAimees: normaliserGouts(x.boissonsAimees),
        niveaux: { ...niveauxVierges(), ...x.niveaux },
        autreAlcool: x.autreAlcool ?? '',
        team: x.team ?? '',
        servicesPreferes: x.servicesPreferes ?? [],
        goodies: x.goodies ?? [],
        goodiesAutre: x.goodiesAutre ?? '',
      })),
    });
    this.participants.set(
      distant.participants.map((x) => ({
        ...x,
        effectifs: x.effectifs ?? [],
      })),
    );
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

  // -- Profil de l'evenement -----------------------------------------------

  readonly infos = computed(() => this.partage().infos);

  majInfos(patch: Partial<Partage['infos']>): void {
    this.majPartage({ infos: { ...this.infos(), ...patch } });
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

  /**
   * L'ancienne saisie « j'amene trois buveurs de biere » n'a plus d'ecran :
   * ce bouton vide les effectifs anonymes herites, une fois les personnes
   * recreees en fiches nominatives.
   */
  viderEffectifsAnonymes(): void {
    for (const participant of this.participants()) {
      if (participant.effectifs.length > 0) {
        this.majParticipant(participant.id, { effectifs: [] });
      }
    }
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

  // -- Paiement des invites ------------------------------------------------

  ajouterCategoriePaiement(): string {
    const id = identifiant();
    this.majPartage({
      categoriesPaiement: [...this.categoriesPaiement(), { id, nom: '', montant: 0 }],
    });
    return id;
  }

  majCategoriePaiement(categorieId: string, patch: Partial<Omit<CategoriePaiement, 'id'>>): void {
    this.majPartage({
      categoriesPaiement: this.categoriesPaiement().map((x) =>
        x.id === categorieId ? { ...x, ...patch } : x,
      ),
    });
  }

  supprimerCategoriePaiement(categorieId: string): void {
    this.majPartage({
      categoriesPaiement: this.categoriesPaiement().filter((x) => x.id !== categorieId),
      // Les invites qui portaient cette categorie repartent sans tarif.
      invites: this.invitesNommes().map((x) =>
        x.categoriePaiementId === categorieId ? { ...x, categoriePaiementId: '' } : x,
      ),
    });
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

  ajouterIngredient(repasId: string): string {
    const id = identifiant();
    this.majRepasParId(repasId, (repas) => ({
      ingredients: [...repas.ingredients, ingredientVierge(id)],
    }));
    return id;
  }

  majIngredient(
    repasId: string,
    ingredientId: string,
    patch: Partial<Omit<IngredientRepas, 'id'>>,
  ): void {
    this.majRepasParId(repasId, (repas) => ({
      ingredients: repas.ingredients.map((x) => (x.id === ingredientId ? { ...x, ...patch } : x)),
    }));
  }

  supprimerIngredient(repasId: string, ingredientId: string): void {
    this.majRepasParId(repasId, (repas) => ({
      ingredients: repas.ingredients.filter((x) => x.id !== ingredientId),
    }));
  }

  private majRepasParId(repasId: string, patch: (repas: Repas) => Partial<Repas>): void {
    const nourriture = this.nourriture();
    const repas = nourriture.repas.find((x) => x.id === repasId);
    if (!repas) return;
    this.majPartage({
      nourriture: {
        ...nourriture,
        repas: nourriture.repas.map((x) => (x.id === repasId ? { ...x, ...patch(x) } : x)),
      },
    });
  }

  supprimerRepas(repasId: string): void {
    const nourriture = this.nourriture();
    this.majPartage({
      nourriture: { ...nourriture, repas: nourriture.repas.filter((x) => x.id !== repasId) },
    });
  }

  /**
   * Decide qu'on ne fait pas ce repas. La case garde une trace de la decision
   * — sans elle, elle repasserait en « repas a decider » a la seconde ou on
   * l'a videe, et on se reposerait la question a chaque passage.
   */
  sauterRepas(jour: number, moment: MomentRepas): void {
    this.definirRepas(jour, moment, {
      sansRepas: true,
      plat: '',
      typePlat: 'a-definir',
      coutParPersonne: 0,
      ingredients: [],
    });
  }

  /** On remet le repas au programme : la case redevient a decider. */
  remettreRepas(repasId: string): void {
    this.majRepasParId(repasId, () => ({ sansRepas: false }));
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

  // -- Liste de courses unifiee --------------------------------------------

  /**
   * Coche ou decoche une ligne de courses. Le materiel a deja son statut :
   * cocher une ligne materiel bascule le statut de l'article, pas la liste.
   */
  basculerCourse(ligneId: string): void {
    // Le rayon porte son propre etat « achete » : c'est lui qui fait foi.
    if (ligneId.startsWith('rayon:')) {
      const articleId = ligneId.slice('rayon:'.length);
      const article = this.coursesLibres().find((x) => x.id === articleId);
      if (article) this.majCourseLibre(articleId, { achete: !article.achete });
      return;
    }

    if (ligneId.startsWith('materiel:')) {
      const articleId = ligneId.slice('materiel:'.length);
      const article = this.articles().find((x) => x.id === articleId);
      if (!article) return;
      const achete = article.statut === 'achete' || article.statut === 'recupere';
      this.majArticle(articleId, { statut: achete ? 'a-prevoir' : 'achete' });
      return;
    }

    const cochees = new Set(this.partage().coursesCochees);
    if (cochees.has(ligneId)) cochees.delete(ligneId);
    else cochees.add(ligneId);
    this.majPartage({ coursesCochees: [...cochees] });
  }

  // -- Le rayon : ce qu'on ajoute a la main a la liste ----------------------

  /**
   * Pose un article dans le rayon. Le nom et la photo viennent de la
   * recherche ; la quantite et le prix sont ceux que l'organisateur a saisis —
   * on ne devine jamais un prix.
   */
  ajouterCourseLibre(article: Omit<ArticleCourse, 'id' | 'achete'>): string {
    const id = identifiant();
    this.majPartage({
      coursesLibres: [...this.coursesLibres(), { ...article, id, achete: false }],
    });
    return id;
  }

  majCourseLibre(articleId: string, patch: Partial<Omit<ArticleCourse, 'id'>>): void {
    this.majPartage({
      coursesLibres: this.coursesLibres().map((x) => (x.id === articleId ? { ...x, ...patch } : x)),
    });
  }

  supprimerCourseLibre(articleId: string): void {
    this.majPartage({ coursesLibres: this.coursesLibres().filter((x) => x.id !== articleId) });
  }

  // -- Programme : planning et tracklist -----------------------------------

  ajouterCreneau(jour: number): string {
    const id = identifiant();
    const programme = this.programme();
    this.majPartage({
      programme: { ...programme, creneaux: [...programme.creneaux, creneauVierge(id, jour)] },
    });
    return id;
  }

  majCreneau(creneauId: string, patch: Partial<Omit<Creneau, 'id'>>): void {
    const programme = this.programme();
    this.majPartage({
      programme: {
        ...programme,
        creneaux: programme.creneaux.map((x) => (x.id === creneauId ? { ...x, ...patch } : x)),
      },
    });
  }

  supprimerCreneau(creneauId: string): void {
    const programme = this.programme();
    this.majPartage({
      programme: { ...programme, creneaux: programme.creneaux.filter((x) => x.id !== creneauId) },
    });
  }

  /** Met quelqu'un en mission sur un creneau ; deja present = rien. */
  assignerPersonne(creneauId: string, ref: string): void {
    const creneau = this.programme().creneaux.find((x) => x.id === creneauId);
    if (!creneau || !ref || creneau.assignes.includes(ref)) return;
    this.majCreneau(creneauId, { assignes: [...creneau.assignes, ref] });
  }

  retirerAssignation(creneauId: string, ref: string): void {
    const creneau = this.programme().creneaux.find((x) => x.id === creneauId);
    if (!creneau) return;
    this.majCreneau(creneauId, { assignes: creneau.assignes.filter((x) => x !== ref) });
  }

  // -- DJ : le tableau horaire des sets ------------------------------------

  ajouterDjSet(modele: Partial<Omit<DjSet, 'id'>> = {}): string {
    const id = identifiant();
    this.majPartage({
      djSets: [...this.djSets(), { ...djSetVierge(id, modele.jour ?? 1), ...modele }],
    });
    return id;
  }

  majDjSet(djSetId: string, patch: Partial<Omit<DjSet, 'id'>>): void {
    this.majPartage({
      djSets: this.djSets().map((x) => (x.id === djSetId ? { ...x, ...patch } : x)),
    });
  }

  supprimerDjSet(djSetId: string): void {
    this.majPartage({ djSets: this.djSets().filter((x) => x.id !== djSetId) });
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
  importerReponse(reponseId: string, participantId: string): string {
    const reponse = this.reponsesFormulaire().find((x) => x.id === reponseId);
    if (!reponse) return '';

    const inviteId = identifiant();
    this.majPartage({
      invites: [
        ...this.invitesNommes(),
        {
          ...inviteVierge(inviteId, participantId),
          prenom: reponse.prenom,
          nom: reponse.nom,
          regime: reponse.regime,
          allergies: reponse.allergies,
          remarques: reponse.commentaire,
          stylesMusicaux: reponse.stylesMusicaux,
          logistique: { ...reponse.logistique },
          // « Je reste tout le sejour » se traduit en jours ; un sejour partiel
          // se decrit en texte libre, donc l'organisateur tranchera lui-meme.
          joursPresents: reponse.logistique.sejourComplet ? tousLesJours(this.partage().jours) : [],
          surnom: reponse.surnom,
          telephone: reponse.telephone,
          // Les gouts declares suivent : ils orientent le profil, sans jamais
          // le decider a la place de l'organisateur.
          boissonsAimees: [...reponse.boissonsAimees],
          niveaux: { ...reponse.niveaux },
          autreAlcool: reponse.autreAlcool,
          team: reponse.team,
          servicesPreferes: [...reponse.servicesPreferes],
          goodies: [...reponse.goodies],
          goodiesAutre: reponse.goodiesAutre,
        },
      ],
      reponsesFormulaire: this.reponsesFormulaire().filter((x) => x.id !== reponseId),
    });
    return inviteId;
  }

  /**
   * Valide une fiche de bout en bout : la personne entre dans les invites, et
   * la consommation relue par l'organisateur devient SA consommation.
   *
   * Chaque fiche validee porte la sienne. Il n'y a plus de bibliotheque de
   * profils a entretenir : le formulaire declare, l'organisateur relit et
   * corrige, et c'est cette consommation-la qui part dans le calcul.
   */
  validerFiche(
    reponseId: string,
    participantId: string,
    consommation: readonly ConsommationType[],
  ): void {
    const reponse = this.reponsesFormulaire().find((x) => x.id === reponseId);
    if (!reponse) return;
    const inviteId = this.importerReponse(reponseId, participantId);
    if (!inviteId) return;

    const retenues = consommation.filter((x) => x.verresParJour > 0);
    if (retenues.length === 0) return;

    const profilId = this.creerPersonneType();
    this.majPersonneType(profilId, {
      nom: `${reponse.prenom} ${reponse.nom}`.trim() || 'Fiche validee',
      description: 'Consommation relue et validee a partir de sa declaration.',
      emoji: '🍹',
      consommation: retenues.map((x) => ({ ...x })),
    });
    this.majInvite(inviteId, { personneTypeId: profilId });
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
