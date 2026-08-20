import { BOISSONS_ALCOOLISEES, BOISSON_PAR_ID, ORDRE_CATEGORIE, PRODUIT_PAR_ID } from './catalogue';
import {
  Ajustement,
  BesoinDiluant,
  Cadre,
  DetailLigne,
  LigneAchat,
  Materiel,
  Override,
  Panier,
  PartCout,
  Partage,
  Participant,
  PersonneType,
  Produit,
  ReglagesCalcul,
  ResumeBoisson,
  ResumePersonneType,
  VerresBoisson,
} from './models';

/** Marge de securite : on est plus large sur les diluants, ce sont eux qui manquent. */
export const MARGE_ALCOOL = 0.1;
export const MARGE_DILUANT = 0.25;

export const MATERIEL_PAR_DEFAUT: Materiel = { prixTireuse: 0 };

export interface EntreeCalcul {
  /** Verres a servir par boisson, deja consolides sur tous les participants. */
  consommation: readonly VerresBoisson[];
  /** formatId -> produitId choisi (biere en bouteille ou en fut). */
  formats: ReadonlyMap<string, string>;
  /** produitId -> prix et contenance corriges par l'utilisateur. */
  overrides: ReadonlyMap<string, Override>;
  /** produitId -> forfait / plaisir. */
  ajustements: ReadonlyMap<string, Ajustement>;
  materiel: Materiel;
  jours: number;
  /** Marges et coup de pouce ; absent, le moteur prend ses valeurs d'usine. */
  reglages?: ReglagesCalcul;
}

/** Les valeurs d'usine : celles qui tenaient dans des constantes avant. */
export function reglagesCalculParDefaut(): ReglagesCalcul {
  return {
    margeAlcoolPct: MARGE_ALCOOL * 100,
    margeDiluantPct: MARGE_DILUANT * 100,
    coefficientPct: 0,
  };
}

/**
 * Resout un produit de recette vers le produit reellement achete : le format
 * choisi (fut plutot que bouteille) puis les corrections de prix et de
 * contenance saisies par l'utilisateur.
 */
export function resoudre(
  produitId: string,
  formats: ReadonlyMap<string, string>,
  overrides: ReadonlyMap<string, Override>,
): Produit | undefined {
  const catalogue = PRODUIT_PAR_ID.get(produitId);
  if (!catalogue) return undefined;

  const remplacant = catalogue.format ? formats.get(catalogue.format) : undefined;
  const choisi = (remplacant && PRODUIT_PAR_ID.get(remplacant)) || catalogue;
  return appliquerOverride(choisi, overrides);
}

export function appliquerOverride(
  produit: Produit,
  overrides: ReadonlyMap<string, Override>,
): Produit {
  const override = overrides.get(produit.id);
  if (!override) return produit;
  return {
    ...produit,
    prixEur: override.prixEur ?? produit.prixEur,
    contenanceMl: override.contenanceMl ?? produit.contenanceMl,
  };
}

const AJUSTEMENT_NEUTRE: Ajustement = { plaisir: false, strategie: { type: 'auto' } };

export function ajustementDe(
  produitId: string,
  ajustements: ReadonlyMap<string, Ajustement>,
): Ajustement {
  return ajustements.get(produitId) ?? AJUSTEMENT_NEUTRE;
}

interface Besoin {
  produit: Produit;
  ml: number;
  detail: Map<string, number>;
}

/**
 * Coeur du moteur. Agrege les recettes en millilitres par produit, puis ne
 * convertit en bouteilles qu'une seule fois, a la fin, sur le total.
 */
export function calculerPanier(entree: EntreeCalcul): Panier {
  const besoins = new Map<string, Besoin>();
  // Les diluants ne partent pas dans les courses, mais on garde leur detail :
  // savoir qu'il faut 12 L de coca vaut mieux que « prevois du soft ».
  const diluants = new Map<string, Besoin>();
  const resumeBoissons: ResumeBoisson[] = [];
  let verresTotal = 0;
  let verresAlcoolises = 0;
  let alcoolPurMl = 0;
  let volumeAlcoolMl = 0;
  let volumeSpiritueuxMl = 0;
  let volumeDiluantMl = 0;
  let volumeSoftMl = 0;

  for (const ligne of entree.consommation) {
    const boisson = BOISSON_PAR_ID.get(ligne.boissonId);
    if (!boisson) continue;

    const verres = Math.max(0, ligne.verres);
    let alcoolPurBoisson = 0;
    let volumeBoisson = 0;

    for (const composant of boisson.composants) {
      const produit = resoudre(composant.produitId, entree.formats, entree.overrides);
      if (!produit) continue;

      const ml = verres * composant.ml;
      alcoolPurBoisson += (ml * produit.degre) / 100;
      volumeBoisson += ml;

      if (produit.degre > 0) {
        volumeAlcoolMl += ml;
        if (produit.categorie === 'spiritueux' || produit.categorie === 'liqueur') {
          volumeSpiritueuxMl += ml;
        }
      } else {
        volumeDiluantMl += ml;
      }

      // Un diluant de recette : ce que le rhum reclame en coca. Un soft bu
      // pour lui-meme n'en est pas un — il s'achete par la ligne normale.
      if (composant.role === 'diluant') {
        const attendu = diluants.get(produit.id);
        if (attendu) {
          attendu.ml += ml;
          attendu.detail.set(boisson.nom, (attendu.detail.get(boisson.nom) ?? 0) + ml);
        } else {
          diluants.set(produit.id, { produit, ml, detail: new Map([[boisson.nom, ml]]) });
        }
      }

      // Les diluants ne s'achetent pas par le calcul. On sait qu'il faut du
      // coca avec le rhum, mais la marque, le format et la quantite se
      // decident devant le rayon — et personne ne veut se voir imposer
      // dix-sept bouteilles de tonic. Leur volume reste compte dans les
      // statistiques, il ne part simplement pas dans les courses.
      if (produit.degre <= 0) continue;

      const besoin = besoins.get(produit.id);
      if (besoin) {
        besoin.ml += ml;
        besoin.detail.set(boisson.nom, (besoin.detail.get(boisson.nom) ?? 0) + ml);
      } else {
        besoins.set(produit.id, { produit, ml, detail: new Map([[boisson.nom, ml]]) });
      }
    }

    const alcoolisee = alcoolPurBoisson > 0;
    verresTotal += verres;
    if (alcoolisee) verresAlcoolises += verres;
    else volumeSoftMl += volumeBoisson;
    alcoolPurMl += alcoolPurBoisson;

    // Plusieurs participants peuvent prevoir la meme boisson : on cumule au
    // lieu de la faire apparaitre deux fois dans les contributeurs.
    const deja = resumeBoissons.find((x) => x.boissonId === boisson.id);
    if (deja) {
      deja.verres += verres;
      deja.alcoolPurMl += alcoolPurBoisson;
    } else {
      resumeBoissons.push({
        boissonId: boisson.id,
        nom: boisson.nom,
        verres,
        alcoolPurMl: alcoolPurBoisson,
        alcoolisee,
      });
    }
  }

  // Produits ajoutes a la main : aucun besoin issu des recettes ne les reclame.
  for (const [produitId, ajustement] of entree.ajustements) {
    if (besoins.has(produitId)) continue;
    if (ajustement.strategie.type !== 'forfait' || ajustement.strategie.bouteilles <= 0) continue;
    const produit = PRODUIT_PAR_ID.get(produitId);
    if (produit) {
      besoins.set(produitId, {
        produit: appliquerOverride(produit, entree.overrides),
        ml: 0,
        detail: new Map(),
      });
    }
  }

  const reglages = entree.reglages ?? reglagesCalculParDefaut();
  const lignes = [...besoins.values()]
    .map((besoin) =>
      construireLigne(besoin, ajustementDe(besoin.produit.id, entree.ajustements), reglages),
    )
    .filter((ligne) => ligne.bouteilles > 0)
    .sort(comparerLignes);

  let coutBase = 0;
  let coutPlaisir = 0;
  let coutAlcool = 0;
  let volumeAcheteMl = 0;
  let volumeResteMl = 0;
  let besoinTireuse = false;

  for (const ligne of lignes) {
    if (ligne.plaisir) coutPlaisir += ligne.prixTotal;
    else coutBase += ligne.prixTotal;
    if (ligne.produit.degre > 0) coutAlcool += ligne.prixTotal;
    volumeAcheteMl += ligne.bouteilles * ligne.produit.contenanceMl;
    volumeResteMl += Math.max(0, ligne.resteMl);
    if (ligne.produit.requiertTireuse) besoinTireuse = true;
  }

  const coutMateriel = coutDuMateriel(entree.materiel);

  return {
    lignes,
    resumeBoissons: resumeBoissons.sort((a, b) => b.verres - a.verres),
    verresTotal,
    verresAlcoolises,
    alcoolPurMl,
    volumeAlcoolMl,
    volumeSpiritueuxMl,
    volumeDiluantMl,
    besoinsDiluants: construireDiluants(diluants, reglages),
    volumeSoftMl,
    volumeServiMl: volumeAlcoolMl + volumeDiluantMl,
    volumeAcheteMl,
    volumeResteMl,
    coutAlcool,
    coutBase,
    coutPlaisir,
    coutMateriel,
    coutTotal: coutBase + coutPlaisir + coutMateriel,
    besoinTireuse,
  };
}

/** La tireuse est un cout unique : ni par bouteille, ni par personne, ni par jour. */
export function coutDuMateriel(materiel: Materiel): number {
  return Math.max(0, materiel.prixTireuse);
}

/**
 * Le besoin en diluant, du plus gros au plus petit. La marge y est plus large
 * que sur l'alcool : c'est le coca qui manque a 1 h du matin, jamais le rhum.
 */
function construireDiluants(
  diluants: Map<string, Besoin>,
  reglages: ReglagesCalcul,
): BesoinDiluant[] {
  const coup = 1 + Math.max(0, reglages.coefficientPct) / 100;
  const marge = 1 + Math.max(0, reglages.margeDiluantPct) / 100;

  return [...diluants.values()]
    .map(({ produit, ml, detail }) => {
      const mlAvecMarge = ml * coup * marge;
      return {
        produit,
        ml,
        mlAvecMarge,
        bouteilles: produit.contenanceMl > 0 ? Math.ceil(mlAvecMarge / produit.contenanceMl) : 0,
        boissons: [...detail.entries()].sort((a, b) => b[1] - a[1]).map(([nom]) => nom),
      };
    })
    .sort((a, b) => b.ml - a.ml);
}

function construireLigne(
  besoin: Besoin,
  ajustement: Ajustement,
  reglages: ReglagesCalcul,
): LigneAchat {
  const { produit } = besoin;
  // Le coup de pouce global gonfle le besoin avant la marge : c'est un
  // « prevois large », pas une seconde marge de securite.
  const ml = besoin.ml * (1 + Math.max(0, reglages.coefficientPct) / 100);
  const margePct = produit.degre > 0 ? reglages.margeAlcoolPct : reglages.margeDiluantPct;
  const mlAvecMarge = ml * (1 + Math.max(0, margePct) / 100);

  const strategie = ajustement.strategie;
  const forfait = strategie.type === 'forfait';
  const bouteilles =
    strategie.type === 'forfait'
      ? Math.max(0, Math.round(strategie.bouteilles))
      : Math.ceil(arrondir(mlAvecMarge / produit.contenanceMl, 3));

  const detail: DetailLigne[] = [...besoin.detail.entries()]
    .map(([boissonNom, mlBoisson]) => ({ boissonNom, ml: mlBoisson }))
    .sort((a, b) => b.ml - a.ml);

  return {
    produit,
    mlNecessaire: ml,
    mlAvecMarge,
    bouteilles,
    prixTotal: bouteilles * produit.prixEur,
    resteMl: bouteilles * produit.contenanceMl - ml,
    plaisir: ajustement.plaisir,
    forfait,
    detail,
  };
}

function comparerLignes(a: LigneAchat, b: LigneAchat): number {
  const rang =
    ORDRE_CATEGORIE.indexOf(a.produit.categorie) - ORDRE_CATEGORIE.indexOf(b.produit.categorie);
  if (rang !== 0) return rang;
  return b.prixTotal - a.prixTotal;
}

/** Evite qu'un 3.0000000000000004 ne fasse acheter une bouteille de trop. */
function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

// ---------------------------------------------------------------------------
// Pre-remplissage : on ne part jamais d'une page blanche
// ---------------------------------------------------------------------------

export function nombreBuveurs(cadre: Cadre): number {
  return Math.max(1, Math.round(cadre.invites * cadre.partBuveurs));
}

export function nombreNonBuveurs(cadre: Cadre): number {
  return Math.max(0, cadre.invites - nombreBuveurs(cadre));
}

// ---------------------------------------------------------------------------
// Consolidation : profils x effectifs -> verres
// ---------------------------------------------------------------------------

export function invitesDe(participant: Participant): number {
  return participant.effectifs.reduce((somme, x) => somme + Math.max(0, x.nombre), 0);
}

/** Un profil est "buveur" des qu'une seule de ses boissons contient de l'alcool. */
export function estAlcoolisee(personneType: PersonneType): boolean {
  return personneType.consommation.some(
    (x) => x.verresParJour > 0 && BOISSONS_ALCOOLISEES.has(x.boissonId),
  );
}

export function buveursDe(
  participant: Participant,
  personnesTypes: readonly PersonneType[],
): number {
  const index = new Map(personnesTypes.map((x) => [x.id, x]));
  return participant.effectifs.reduce((somme, effectif) => {
    const type = index.get(effectif.personneTypeId);
    return type && estAlcoolisee(type) ? somme + Math.max(0, effectif.nombre) : somme;
  }, 0);
}

/**
 * Le cadre de l'evenement se deduit entierement des effectifs : plus personne
 * ne saisit un nombre d'invites ou un pourcentage de buveurs a la main.
 */
export function consoliderCadre(participants: readonly Participant[], partage: Partage): Cadre {
  const invites = participants.reduce((somme, x) => somme + invitesDe(x), 0);
  const buveurs = participants.reduce(
    (somme, x) => somme + buveursDe(x, partage.personnesTypes),
    0,
  );
  return {
    invites,
    jours: partage.jours,
    profil: partage.profil,
    partBuveurs: invites > 0 ? buveurs / invites : 0,
  };
}

/**
 * Coeur de la consolidation : chaque personne d'un profil boit N verres par
 * jour, multiplies par le nombre de jours et par l'effectif declare.
 */
export function consommationDe(
  participants: readonly Participant[],
  personnesTypes: readonly PersonneType[],
  jours: number,
): VerresBoisson[] {
  const index = new Map(personnesTypes.map((x) => [x.id, x]));
  const total = new Map<string, number>();
  const duree = Math.max(1, jours);

  for (const participant of participants) {
    for (const effectif of participant.effectifs) {
      const type = index.get(effectif.personneTypeId);
      if (!type) continue;
      const personnes = Math.max(0, effectif.nombre);
      if (personnes === 0) continue;

      for (const ligne of type.consommation) {
        const verres = personnes * Math.max(0, ligne.verresParJour) * duree;
        if (verres > 0) total.set(ligne.boissonId, (total.get(ligne.boissonId) ?? 0) + verres);
      }
    }
  }

  return [...total.entries()].map(([boissonId, verres]) => ({ boissonId, verres }));
}

/** Ce que chaque profil pese dans l'evenement, pour l'afficher tel quel. */
export function resumerPersonnesTypes(
  participants: readonly Participant[],
  personnesTypes: readonly PersonneType[],
): ResumePersonneType[] {
  return personnesTypes.map((personneType) => ({
    personneType,
    effectif: participants.reduce(
      (somme, participant) =>
        somme +
        participant.effectifs
          .filter((x) => x.personneTypeId === personneType.id)
          .reduce((sousTotal, x) => sousTotal + Math.max(0, x.nombre), 0),
      0,
    ),
    verresParJour: personneType.consommation.reduce(
      (somme, x) => somme + Math.max(0, x.verresParJour),
      0,
    ),
    alcoolisee: estAlcoolisee(personneType),
  }));
}

/**
 * Qui paye quoi. La cle de repartition est le volume que les invites de chacun
 * consomment reellement, pas le nombre de tetes : celui qui amene dix personnes
 * qui boivent de l'eau ne paye pas la note des autres.
 */
export function repartirCout(
  participants: readonly Participant[],
  personnesTypes: readonly PersonneType[],
  entree: EntreeCalcul,
  jours: number,
): PartCout[] {
  const volumes = participants.map((participant) => {
    const seul = calculerPanier({
      ...entree,
      consommation: consommationDe([participant], personnesTypes, jours),
    });
    return {
      participant,
      // Le volume avant arrondi : la seule mesure additive et sans biais.
      volume: seul.volumeServiMl,
      verres: seul.verresTotal,
    };
  });

  const total = volumes.reduce((somme, x) => somme + x.volume, 0);
  const montantTotal = calculerPanier(entree).coutTotal;

  return volumes.map(({ participant, volume, verres }) => {
    const part = total > 0 ? volume / total : 0;
    return {
      participantId: participant.id,
      nom: participant.nom,
      invites: invitesDe(participant),
      verres,
      part: part * 100,
      montant: montantTotal * part,
    };
  });
}
