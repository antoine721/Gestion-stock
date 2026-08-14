/**
 * Modele du domaine.
 *
 * Principe : cote demande on ne raisonne JAMAIS en bouteilles, uniquement en
 * millilitres d'ingredients. La conversion en bouteilles n'arrive qu'a la toute
 * fin, une seule fois, sur le total agrege.
 */

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export type Categorie = 'spiritueux' | 'liqueur' | 'vin' | 'biere' | 'soft' | 'sirop';

export interface Produit {
  id: string;
  nom: string;
  categorie: Categorie;
  /** Degre d'alcool. 0 pour les softs et les sirops. */
  degre: number;
  contenanceMl: number;
  prixEur: number;
  /** Une bouteille entamee survit-elle a l'evenement ? */
  seConserve: boolean;
  /**
   * Produit generique : n'importe quelle marque fera l'affaire. Absent => la
   * marque EST le produit (Ricard, Captain Morgan, Aperol...).
   */
  generique?: boolean;
  /**
   * Famille de conditionnement. Les produits qui la partagent sont le meme
   * breuvage sous un autre format : biere en bouteille, en fut de 20 L...
   */
  format?: string;
  /** Libelle du conditionnement, affiche dans le selecteur de format. */
  formatNom?: string;
  /** Un fut pression a besoin d'une tireuse ; un mini-fut a son propre robinet. */
  requiertTireuse?: boolean;
}

/** Le prix et le format du catalogue ne sont que des valeurs par defaut. */
export interface Override {
  prixEur?: number;
  contenanceMl?: number;
}

export type Role = 'base' | 'modificateur' | 'diluant';

export interface Composant {
  produitId: string;
  /** Dose en ml POUR UN VERRE. */
  ml: number;
  role: Role;
}

export type FamilleBoisson = 'cocktail' | 'sec' | 'shot' | 'vin' | 'biere' | 'soft';

/**
 * Une boisson servie. Y compris "biere" ou "rose", qui sont des recettes a un
 * seul composant : aucune exception dans le moteur de calcul.
 */
export interface Boisson {
  id: string;
  nom: string;
  famille: FamilleBoisson;
  verreMl: number;
  /** 1 a 5, sert uniquement au pre-remplissage de la prediction. */
  popularite: number;
  composants: Composant[];
}

// ---------------------------------------------------------------------------
// Cadre de l'evenement (fixe au debut)
// ---------------------------------------------------------------------------

export type Profil = 'soft' | 'normal' | 'festif';

/**
 * Le cadre consolide : le nombre d'invites est la somme de ce que chaque
 * co-organisateur a declare, la duree et le profil sont communs a l'evenement.
 */
export interface Cadre {
  invites: number;
  jours: number;
  /** Part des invites qui boivent de l'alcool (0 a 1). */
  partBuveurs: number;
  profil: Profil;
}

/** Ratios de validation, deduits du profil puis ajustables a la main. */
export interface Cibles {
  verresParBuveurParJour: number;
  alcoolPurClParBuveurParJour: number;
  softLParNonBuveurParJour: number;
  liquideLParPersonneParJour: number;
  ratioDiluantSpiritueux: number;
  partDominanteMaxPct: number;
  restePctMax: number;
  referencesMax: number;
  budgetParPersonneParJour: number;
  partAlcoolBudgetPct: number;
}

// ---------------------------------------------------------------------------
// Materiel
// ---------------------------------------------------------------------------

export interface Materiel {
  /** Prix total de la tireuse, location ou achat : c'est toi qui sais. 0 = pas de tireuse. */
  prixTireuse: number;
}

// ---------------------------------------------------------------------------
// Profils d'invites
// ---------------------------------------------------------------------------

/**
 * Ce qu'une personne d'un type donne boit PAR JOUR. Raisonner par jour rend la
 * saisie stable : un gros buveur de biere en boit cinq par soiree, que la fete
 * dure un jour ou trois.
 */
export interface ConsommationType {
  boissonId: string;
  verresParJour: number;
}

/**
 * Un profil d'invite : « le buveur de biere », « la team spritz ». C'est
 * l'unite de raisonnement de l'app — on compte des gens, pas des bouteilles.
 * Les profils sont communs a l'evenement : chacun peut piocher dans ceux des
 * autres plutot que de redecrire les memes personnes.
 */
export interface PersonneType {
  id: string;
  nom: string;
  description: string;
  /** Une frimousse pour reperer le profil d'un coup d'oeil dans la grille. */
  emoji: string;
  /** Qui l'a cree, pour savoir a qui demander en cas de doute. */
  creeParNom: string;
  consommation: ConsommationType[];
}

/** Combien de personnes de ce type un co-organisateur amene. */
export interface Effectif {
  personneTypeId: string;
  nombre: number;
}

// ---------------------------------------------------------------------------
// Invites nommes : des personnes, pas des effectifs
// ---------------------------------------------------------------------------

export type Regime =
  'omnivore' | 'vegetarien' | 'vegan' | 'sans-gluten' | 'sans-lactose' | 'halal' | 'casher';

/**
 * Une categorie de paiement : « week-end complet 40 € », « une journee 15 € »,
 * « gratuit »... Le paiement lui-meme se fait hors de l'app ; ici on suit qui
 * doit quoi et qui a deja paye.
 */
export interface CategoriePaiement {
  id: string;
  nom: string;
  /** Le tarif attendu pour cette categorie. */
  montant: number;
}

/**
 * Un invite nomme. Le profil de consommation s'attache directement a la
 * personne : « Paul est un buveur de biere », plutot que « j'amene trois
 * buveurs de biere ». Chaque invite nomme compte pour une tete dans le calcul,
 * en plus des effectifs anonymes saisis par profil.
 */
export interface Invite {
  id: string;
  prenom: string;
  nom: string;
  /** Le co-organisateur qui amene cette personne. */
  participantId: string;
  /** Profil de consommation attache a la personne. '' = pas encore choisi. */
  personneTypeId: string;
  regime: Regime;
  allergies: string;
  /** Ce que la personne veut apporter a la fete : DJ, jeux, karaoke... */
  envies: string;
  remarques: string;
  /** Categorie de paiement. '' = pas encore choisie. */
  categoriePaiementId: string;
  /** A regle sa part (le paiement se fait hors de l'app). */
  paye: boolean;
  /** Ce qu'il a reellement verse, qui peut differer du tarif de la categorie. */
  montantPaye: number;
  /** Combien de jours il reste sur place. 0 = toute la duree de l'evenement. */
  joursPresence: number;
}

// ---------------------------------------------------------------------------
// Nourriture : des repas par jour, pas des courses au hasard
// ---------------------------------------------------------------------------

export type MomentRepas = 'petit-dejeuner' | 'dejeuner' | 'diner';

export type UniteIngredient = 'g' | 'ml' | 'piece';

/**
 * Un ingredient d'un repas, dose PAR PERSONNE — le meme invariant que le bar :
 * on raisonne en grammes et millilitres, jamais en paquets. La conversion en
 * paquets n'arrive qu'une fois, a la toute fin, sur le besoin agrege de tous
 * les repas (la viande du barbecue du samedi et celle du dimanche ne font
 * qu'une ligne de courses).
 */
export interface IngredientRepas {
  id: string;
  nom: string;
  /** Dose par personne, dans l'unite choisie. */
  qteParPersonne: number;
  unite: UniteIngredient;
  /** Taille du conditionnement achete (paquet de 500 g, bouteille d'1 L...). */
  conditionnement: number;
  prixConditionnement: number;
}

/**
 * Un repas planifie. Deux facons de le chiffrer : des ingredients doses par
 * personne (le moteur convertit en paquets a la fin), ou a defaut un simple
 * cout par personne. Si des ingredients existent, ils font foi.
 */
export interface Repas {
  id: string;
  /** Jour de l'evenement, 1 = premier jour. */
  jour: number;
  moment: MomentRepas;
  /** Le plat prevu. Vide = repas pas encore decide. */
  plat: string;
  coutParPersonne: number;
  /** Nombre de convives pour CE repas. 0 = tous les invites. */
  convives: number;
  /** Une alternative vegetarienne est prevue. */
  vegetarienPrevu: boolean;
  notes: string;
  ingredients: IngredientRepas[];
}

/** Grignotage et divers : chips, gateaux apero, glace... en quantite fixe. */
export interface ExtraNourriture {
  id: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
}

export interface Nourriture {
  repas: Repas[];
  extras: ExtraNourriture[];
}

// ---------------------------------------------------------------------------
// Materiel : tout ce qui s'achete ou se loue en dehors du frigo
// ---------------------------------------------------------------------------

export type CategorieArticle =
  | 'decoration'
  | 'electricite'
  | 'sono'
  | 'mobilier'
  | 'cuisine'
  | 'vaisselle'
  | 'transport'
  | 'hebergement'
  | 'autre';

export type ModeArticle = 'achat' | 'location';

export type StatutArticle = 'a-prevoir' | 'reserve' | 'achete' | 'recupere';

export interface Article {
  id: string;
  nom: string;
  categorie: CategorieArticle;
  mode: ModeArticle;
  statut: StatutArticle;
  quantite: number;
  prixUnitaire: number;
  /** Caution de location : avancee puis rendue, donc suivie hors budget. */
  caution: number;
  /** Le participant qui avance l'argent. '' = pas encore decide. */
  payeParId: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Formulaire invite : ce que les invites remplissent eux-memes
// ---------------------------------------------------------------------------

export interface ReponseFormulaire {
  id: string;
  prenom: string;
  nom: string;
  /** Qui l'invite, en toutes lettres : le lien se fait a la main ensuite. */
  invitePar: string;
  /** Combien de personnes il amene avec lui (+1, conjoint, enfants...). */
  accompagnants: number;
  regime: Regime;
  allergies: string;
  preferencesBoissons: string;
  /** DJ, jeux, karaoke, tournoi de petanque... */
  envies: string;
  /** Morceaux ou artistes a passer pendant la soiree. */
  recommandations: string;
  commentaire: string;
  /** Date ISO de la reponse. */
  creeLe: string;
}

// ---------------------------------------------------------------------------
// Participants : chaque co-organisateur declare ses propres invites
// ---------------------------------------------------------------------------

export interface Participant {
  id: string;
  nom: string;
  /** Les invites que CETTE personne amene, ventiles par profil. */
  effectifs: Effectif[];
}

/** Total de verres pour une boisson, tous participants et jours confondus. */
export interface VerresBoisson {
  boissonId: string;
  verres: number;
}

/** Ce qui est commun a l'evenement, quel que soit le participant. */
export interface Partage {
  nom: string;
  jours: number;
  profil: Profil;
  cibles: Cibles;
  /** La bibliotheque de profils, utilisable par tous les co-organisateurs. */
  personnesTypes: PersonneType[];
  formats: [string, string][];
  overrides: [string, Override][];
  ajustements: [string, Ajustement][];
  materiel: Materiel;
  /** Les invites nommes, tous co-organisateurs confondus. */
  invites: Invite[];
  nourriture: Nourriture;
  /** Materiel a acheter ou louer : decoration, generateur, sono... */
  articles: Article[];
  reponsesFormulaire: ReponseFormulaire[];
  /** Les tarifs demandes aux invites (le paiement se fait hors de l'app). */
  categoriesPaiement: CategoriePaiement[];
  /** Lignes cochees de la liste de courses unifiee (le materiel a son statut). */
  coursesCochees: string[];
}

export interface Evenement {
  code: string;
  partage: Partage;
  participants: Participant[];
}

/** Qui paye quoi, au prorata du volume que ses invites consomment. */
export interface PartCout {
  participantId: string;
  nom: string;
  invites: number;
  verres: number;
  part: number;
  montant: number;
}

/** Ce qu'un profil represente dans l'evenement, une fois les effectifs saisis. */
export interface ResumePersonneType {
  personneType: PersonneType;
  /** Combien de personnes de ce type, tous co-organisateurs confondus. */
  effectif: number;
  verresParJour: number;
  alcoolisee: boolean;
}

// ---------------------------------------------------------------------------
// Panier
// ---------------------------------------------------------------------------

/** Bouteille "plaisir" : quantite fixe, independante du nombre d'invites. */
export type Strategie = { type: 'auto' } | { type: 'forfait'; bouteilles: number };

export interface Ajustement {
  /** Sorti du budget de base pour ne pas polluer le cout par personne. */
  plaisir: boolean;
  strategie: Strategie;
}

export interface DetailLigne {
  boissonNom: string;
  ml: number;
}

export interface LigneAchat {
  produit: Produit;
  /** Besoin brut issu des recettes. */
  mlNecessaire: number;
  /** Besoin + marge de securite. */
  mlAvecMarge: number;
  bouteilles: number;
  prixTotal: number;
  /** Ce qu'il restera apres l'evenement (negatif = il manquera). */
  resteMl: number;
  plaisir: boolean;
  forfait: boolean;
  /** Quelles boissons consomment ce produit. */
  detail: DetailLigne[];
}

export interface ResumeBoisson {
  boissonId: string;
  nom: string;
  verres: number;
  alcoolPurMl: number;
  /** Une boisson sans une goutte d'alcool ne compte pas dans les ratios buveurs. */
  alcoolisee: boolean;
}

export interface Panier {
  lignes: LigneAchat[];
  resumeBoissons: ResumeBoisson[];
  verresTotal: number;
  verresAlcoolises: number;
  /** Alcool pur consomme, en ml. Seule echelle commune biere / spiritueux. */
  alcoolPurMl: number;
  volumeAlcoolMl: number;
  /** Spiritueux et liqueurs seuls : ce sont eux qui reclament un diluant. */
  volumeSpiritueuxMl: number;
  volumeDiluantMl: number;
  /** Volume des boissons sans alcool, pour ceux qui ne boivent pas. */
  volumeSoftMl: number;
  volumeServiMl: number;
  /** Volume achete, marge et arrondis compris. */
  volumeAcheteMl: number;
  /** Volume qui restera sur les bras apres l'evenement. */
  volumeResteMl: number;
  coutAlcool: number;
  coutBase: number;
  coutPlaisir: number;
  /** Tireuse : un cout unique, ni proportionnel ni par bouteille. */
  coutMateriel: number;
  coutTotal: number;
  /** Un fut pression est prevu et reclame une tireuse. */
  besoinTireuse: boolean;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type EtatRatio = 'ok' | 'warn' | 'ko' | 'vide';

export type GroupeRatio = 'consommation' | 'equilibre' | 'logistique' | 'argent';

export interface Ratio {
  id: string;
  groupe: GroupeRatio;
  label: string;
  aide: string;
  valeur: number;
  cible: number;
  unite: string;
  /** 'cible' = s'en approcher, 'min' = au moins ca, 'max' = pas plus que ca. */
  sens: 'cible' | 'min' | 'max';
  etat: EtatRatio;
  ecartPct: number;
  contributeurs: { nom: string; part: number }[];
}

/** Un probleme concret, que sa nature ne reduit pas a un ratio. */
export interface Alerte {
  id: string;
  niveau: 'warn' | 'ko';
  message: string;
}
