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

/** Paliers declaratifs de consommation, du « rien » a « abuse ». */
export type NiveauConso = 'aucun' | 'peu' | 'moyen' | 'beaucoup' | 'abuse';

/**
 * Les trois familles d'alcool DECLAREES au formulaire, a ne pas confondre avec
 * les familles du catalogue : on ne boit pas la biere, le vin et les
 * spiritueux au meme compteur, donc chacune a son propre rythme.
 */
export type FamilleAlcool = 'biere' | 'vin' | 'spiritueux';

/** Le rythme declare, famille par famille. */
export type NiveauxParFamille = Record<FamilleAlcool, NiveauConso>;

/** Les quatre equipes de buveurs, telles que l'invite se declare. */
export type TeamBuveur = 'chameau' | 'degustation' | 'croisiere' | 'bateau-ivre';

/**
 * Un gout declare : une boisson, et a quel point la personne l'aime, de 0
 * (« j'en bois pas ») a 4 (« je bois que ca »). L'intensite sert a repartir
 * une consommation estimee entre les boissons aimees — jamais a l'augmenter.
 */
export interface GoutBoisson {
  boissonId: string;
  intensite: number;
}

/**
 * Le bloc logistique d'une personne : vehicule, covoiturage, horaires, ce
 * qu'elle peut apporter. Rempli via le formulaire, repris tel quel sur la
 * fiche invite.
 *
 * Il n'y a pas de champ « hebergement » : tout le monde dort sur place, sous
 * tente. La seule question qui reste est de savoir qui amene la sienne.
 */
export interface Logistique {
  /** A le permis de conduire. */
  permis: boolean;
  /** Vient avec une voiture. */
  vehicule: boolean;
  /** Apporte sa tente — sinon il faudra lui trouver une place sous celle d'un autre. */
  tente: boolean;
  /** Present sur toute la duree ; sinon arrivee et depart font foi. */
  sejourComplet: boolean;
  /** Places libres dans sa voiture pour covoiturer. */
  placesVoiture: number;
  /** Cherche une place en covoiturage. */
  chercheCovoiturage: boolean;
  /** Arrivee et depart en texte libre : « samedi 14h », « dimanche matin ». */
  arrivee: string;
  depart: string;
  /** Ce qu'elle peut apporter ou preter : enceinte, barnum, jeux, glaciere... */
  materielApporte: string;
  /** Besoins particuliers : sante, accessibilite, regime du chien... */
  besoins: string;
}

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
  /**
   * Les jours de l'evenement ou la personne est la, 1 = premier jour. Liste
   * vide = toute la duree. On garde les jours eux-memes plutot qu'un compte :
   * « samedi et dimanche » et « vendredi et samedi » ne se preparent pas
   * pareil, alors que ca fait deux jours dans les deux cas.
   */
  joursPresents: number[];
  /** Styles musicaux preferes, pour le DJ. */
  stylesMusicaux: string;
  logistique: Logistique;
  /** Le petit nom, quand tout le monde l'appelle autrement. */
  surnom: string;
  /** Ce qu'elle aime boire, avec l'intensite du gout — declaratif. */
  boissonsAimees: GoutBoisson[];
  /** Ce qu'elle dit boire sur une soiree, famille par famille. */
  niveaux: NiveauxParFamille;
  /** L'alcool qu'on a oublie dans la liste, dans ses mots. */
  autreAlcool: string;
  /** L'equipe dans laquelle elle se range. '' = pas repondu. */
  team: TeamBuveur | '';
  /** Les coups de main qu'elle prefere donner (ids de preferences.ts). */
  servicesPreferes: string[];
  /** Les goodies qui l'interessent (ids de preferences.ts). */
  goodies: string[];
  /** Le goodie qu'on n'avait pas prevu, dans ses mots. */
  goodiesAutre: string;
}

// ---------------------------------------------------------------------------
// Nourriture : des repas par jour, pas des courses au hasard
// ---------------------------------------------------------------------------

export type MomentRepas = 'petit-dejeuner' | 'dejeuner' | 'diner';

/** La forme du repas : elle dit comment on cuisine et ce qu'il faut prevoir. */
export type TypePlat =
  | 'a-definir'
  | 'barbecue'
  | 'plancha'
  | 'buffet-froid'
  | 'plat-mijote'
  | 'pates'
  | 'salade'
  | 'raclette'
  | 'brunch'
  | 'petit-dejeuner'
  | 'pizza'
  | 'traiteur'
  | 'autre';

export type UniteIngredient = 'g' | 'ml' | 'piece';

/**
 * Un ingredient d'un repas, dose PAR PERSONNE — le meme invariant que le bar :
 * on raisonne en grammes et millilitres. L'arrondi a l'unite d'achat n'arrive
 * qu'une fois, a la toute fin, sur le besoin agrege de tous les repas (la
 * viande du barbecue du samedi et celle du dimanche ne font qu'une ligne de
 * courses, et donc un seul arrondi).
 */
export interface IngredientRepas {
  id: string;
  nom: string;
  /** Dose par personne, dans l'unite choisie. */
  qteParPersonne: number;
  unite: UniteIngredient;
  /**
   * Prix dans l'unite d'ACHAT : au kilo pour des grammes, au litre pour des
   * millilitres, a la piece sinon. On ne decrit plus la taille du paquet :
   * personne ne la connait en faisant sa liste, et le magasin affiche de
   * toute facon un prix au kilo.
   */
  prixUnitaire: number;
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
  /** La forme du repas : barbecue, buffet froid, raclette... */
  typePlat: TypePlat;
  /** Le plat prevu. Vide = repas pas encore decide. */
  plat: string;
  /**
   * On a decide de ne PAS faire ce repas : brunch qui remplace le petit
   * dejeuner et le midi, dernier soir ou tout le monde est reparti. C'est une
   * decision prise, pas un oubli — la case ne compte donc plus parmi les repas
   * a decider.
   */
  sansRepas: boolean;
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
  | 'intendance'
  | 'transport'
  | 'hebergement'
  | 'autre';

export type ModeArticle = 'achat' | 'location';

// ---------------------------------------------------------------------------
// Le rayon : ce qu'on ajoute a la main a la liste de courses
// ---------------------------------------------------------------------------

/**
 * Comment un article se compte dans le caddie : a la piece, ou par le poids
 * (ou le volume) de son contenant.
 */
export type UniteAchat = 'piece' | 'g' | 'kg' | 'ml' | 'L';

/** Les rayons de la liste de courses. Ils portent la couleur du camembert. */
export type CategorieCourse =
  'alcool' | 'soft' | 'nourriture' | 'intendance' | 'jetable' | 'materiel' | 'autre';

/**
 * Un article pose a la main dans la liste de courses, en general trouve par
 * la recherche Open Food Facts.
 *
 * Le nom et la photo viennent d'Open Food Facts ; la quantite et le prix, non
 * — ils dependent du magasin et du nombre d'invites, donc c'est l'organisateur
 * qui les pose. Aucun prix n'est jamais devine.
 */
export interface ArticleCourse {
  id: string;
  nom: string;
  /** La marque, quand la recherche l'a donnee : « Lotus », « Sopalin ». */
  marque: string;
  /** Le code-barres Open Food Facts, vide si l'article a ete saisi a la main. */
  code: string;
  imageUrl: string;
  categorie: CategorieCourse;
  /** Combien de contenants on achete. */
  quantite: number;
  /**
   * Ce que pese (ou contient) UN contenant. 0 avec l'unite « piece » : la
   * ligne se lit alors « × 4 » et non « 4 × 0 ».
   */
  contenance: number;
  unite: UniteAchat;
  prixUnitaire: number;
  /** Coche dans la liste de courses. */
  achete: boolean;
}

export type StatutArticle = 'a-prevoir' | 'reserve' | 'achete' | 'recupere';

export interface Article {
  id: string;
  nom: string;
  categorie: CategorieArticle;
  mode: ModeArticle;
  statut: StatutArticle;
  /**
   * La quantite a acheter. Elle est figee, SAUF si `qteParPersonne` est
   * renseigne : le PQ et les assiettes se dimensionnent au nombre de tetes,
   * pas a la main.
   */
  quantite: number;
  /**
   * Dosage par personne et par jour. 0 = quantite fixe (une nappe, un
   * barnum). Meme grammaire que les repas : on dose par personne, et on
   * arrondit a l'unite d'achat une seule fois, a la fin.
   */
  qteParPersonne: number;
  prixUnitaire: number;
  /** Caution de location : avancee puis rendue, donc suivie hors budget. */
  caution: number;
  /** Le participant qui avance l'argent. '' = pas encore decide. */
  payeParId: string;
  notes: string;
  /**
   * L'article du catalogue d'intendance dont il est ne. Sert a retrouver son
   * visuel et a ne pas le poser deux fois. Vide pour un article saisi a la main.
   */
  refCatalogue: string;
  /**
   * Une vraie photo, si on en a une. Sinon l'app dessine l'illustration de la
   * forme du produit — il y a toujours quelque chose a montrer.
   */
  imageUrl: string;
}

// ---------------------------------------------------------------------------
// Programme : le planning du festival et la musique
// ---------------------------------------------------------------------------

export type TypeCreneau = 'activite' | 'repas' | 'musique' | 'logistique' | 'autre';

/**
 * Un creneau du planning : une mission datee. Les heures sont du texte
 * « 18:30 » — assez pour trier et lire, pas de fuseau ni de date a gerer.
 * Tout le monde participe : chaque creneau porte ses assignes, et les
 * equipes changent d'un creneau a l'autre.
 */
export interface Creneau {
  id: string;
  /** Jour de l'evenement, 1 = premier jour. */
  jour: number;
  debut: string;
  fin: string;
  titre: string;
  type: TypeCreneau;
  /** Qui s'en occupe, en toutes lettres (complement libre des assignes). */
  responsable: string;
  lieu: string;
  notes: string;
  /**
   * Les personnes en mission sur ce creneau : des references prefixees —
   * 'inv:<id>' pour un invite nomme, 'org:<id>' pour un co-organisateur.
   */
  assignes: string[];
}

// Le workflow d'un set DJ : un invite demande, l'orga valide, le set se joue.
export type StatutDjSet = 'demande' | 'valide' | 'refuse' | 'joue';

/** Un passage derriere les platines, planifie et suivi. */
export interface DjSet {
  id: string;
  /** Jour de l'evenement, 1 = premier jour. */
  jour: number;
  debut: string;
  fin: string;
  /** Qui mixe : reference 'inv:'/'org:' ou nom libre. */
  dj: string;
  /** Ce qu'il compte passer : styles, ambiance. */
  style: string;
  statut: StatutDjSet;
  /** Le suivi : materiel, contraintes, retours. */
  notes: string;
}

/** Un morceau de la tracklist, avec la personne qui l'a demande. */
export interface Morceau {
  id: string;
  titre: string;
  artiste: string;
  demandePar: string;
}

export interface Programme {
  creneaux: Creneau[];
  tracklist: Morceau[];
}

// ---------------------------------------------------------------------------
// Formulaire invite : ce que les invites remplissent eux-memes
// ---------------------------------------------------------------------------

export interface ReponseFormulaire {
  id: string;
  prenom: string;
  nom: string;
  /**
   * Le co-organisateur choisi dans le formulaire. C'est lui qui recuperera la
   * fiche a la validation, sans qu'on ait a deviner : l'invite sait tres bien
   * qui l'a invite, nous non.
   */
  invitParId: string;
  /** Son nom au moment de la reponse, pour rester lisible s'il s'en va. */
  invitePar: string;
  regime: Regime;
  allergies: string;
  commentaire: string;
  /** Styles musicaux preferes, pour le DJ. */
  stylesMusicaux: string;
  logistique: Logistique;
  /** Le petit nom, quand tout le monde l'appelle autrement. */
  surnom: string;
  /** Ce qu'il aime boire, avec l'intensite du gout — declaratif. */
  boissonsAimees: GoutBoisson[];
  niveaux: NiveauxParFamille;
  /** L'alcool qu'on a oublie dans la liste, dans ses mots. */
  autreAlcool: string;
  team: TeamBuveur | '';
  /** Les coups de main qu'il prefere donner (ids de preferences.ts). */
  servicesPreferes: string[];
  /** Les goodies qui l'interessent (ids de preferences.ts). */
  goodies: string[];
  /** Le goodie qu'on n'avait pas prevu, dans ses mots. */
  goodiesAutre: string;
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

/** La carte d'identite de l'evenement : ou, quand, et de quoi il s'agit. */
export interface InfosEvenement {
  lieu: string;
  /** Dates ISO (AAAA-MM-JJ), vides tant qu'elles ne sont pas calees. */
  debut: string;
  fin: string;
  description: string;
}

/** Ce qui est commun a l'evenement, quel que soit le participant. */
export interface Partage {
  nom: string;
  jours: number;
  infos: InfosEvenement;
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
  /** Ce qu'on a ajoute a la main au rayon : PQ, sacs poubelle, charbon... */
  coursesLibres: ArticleCourse[];
  /** Le planning du festival et la tracklist. */
  programme: Programme;
  /** Les sets DJ, avec leur workflow demande -> valide -> joue. */
  djSets: DjSet[];
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
