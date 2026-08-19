import { nombreBuveurs, nombreNonBuveurs } from './calcul';
import { Alerte, Cadre, Cibles, EtatRatio, GroupeRatio, Panier, Profil, Ratio } from './models';

/**
 * Cibles par profil, exprimees PAR JOUR. Le but est de detecter une prediction
 * absurde, pas de faire de la sante publique.
 *
 * Elles sont calees sur les doses du catalogue : un verre y pese environ 1,5 cl
 * d'alcool pur (4 cl de spiritueux a 40 %, ou 33 cl de biere a 5 %) pour un
 * volume servi moyen d'environ 20 cl.
 */
export const PROFILS: Record<Profil, Cibles> = {
  soft: {
    verresParBuveurParJour: 2.5,
    alcoolPurClParBuveurParJour: 4,
    softLParNonBuveurParJour: 0.6,
    liquideLParPersonneParJour: 0.45,
    ratioDiluantSpiritueux: 2,
    partDominanteMaxPct: 50,
    restePctMax: 25,
    referencesMax: 15,
    budgetParPersonneParJour: 4,
    partAlcoolBudgetPct: 75,
  },
  normal: {
    verresParBuveurParJour: 4.5,
    alcoolPurClParBuveurParJour: 7,
    softLParNonBuveurParJour: 0.8,
    liquideLParPersonneParJour: 0.75,
    ratioDiluantSpiritueux: 2,
    partDominanteMaxPct: 50,
    restePctMax: 25,
    referencesMax: 15,
    budgetParPersonneParJour: 7,
    partAlcoolBudgetPct: 75,
  },
  festif: {
    verresParBuveurParJour: 7,
    alcoolPurClParBuveurParJour: 11,
    softLParNonBuveurParJour: 1,
    liquideLParPersonneParJour: 1.2,
    ratioDiluantSpiritueux: 2,
    partDominanteMaxPct: 50,
    restePctMax: 25,
    referencesMax: 20,
    budgetParPersonneParJour: 11,
    partAlcoolBudgetPct: 75,
  },
};

export const LIBELLE_PROFIL: Record<Profil, string> = {
  soft: 'Soft',
  normal: 'Normale',
  festif: 'Festive',
};

export const LIBELLE_GROUPE: Record<GroupeRatio, string> = {
  consommation: 'Consommation',
  equilibre: 'Equilibre',
  logistique: 'Logistique',
  argent: 'Argent',
};

export const ORDRE_GROUPE: readonly GroupeRatio[] = [
  'consommation',
  'equilibre',
  'logistique',
  'argent',
];

const SEUIL_OK = 0.15;
const SEUIL_WARN = 0.4;

/** Une valeur pile sur la cible ne doit pas basculer sur du bruit flottant. */
const EPSILON = 1.001;

export function etatDe(valeur: number, cible: number, sens: Ratio['sens']): EtatRatio {
  if (cible <= 0) return 'vide';
  if (sens === 'min') {
    if (valeur * EPSILON >= cible) return 'ok';
    return valeur * EPSILON >= cible * 0.6 ? 'warn' : 'ko';
  }
  if (sens === 'max') {
    if (valeur <= cible * EPSILON) return 'ok';
    return valeur <= cible * 1.4 * EPSILON ? 'warn' : 'ko';
  }
  const ecart = Math.abs(valeur - cible) / cible;
  if (ecart <= SEUIL_OK) return 'ok';
  return ecart <= SEUIL_WARN ? 'warn' : 'ko';
}

/**
 * Compare la prediction aux ratios fixes au depart. Ne bloque rien : c'est un
 * controle de vraisemblance, tu peux valider quand meme.
 */
export function calculerRatios(cadre: Cadre, cibles: Cibles, panier: Panier): Ratio[] {
  const buveurs = nombreBuveurs(cadre);
  const nonBuveurs = nombreNonBuveurs(cadre);
  const invites = Math.max(1, cadre.invites);
  const jours = Math.max(1, cadre.jours);
  const buveurJours = buveurs * jours;
  const personneJours = invites * jours;

  const alcoolisees = panier.resumeBoissons.filter((x) => x.alcoolisee);
  const dominante = partDominante(panier);
  const restePct =
    panier.volumeAcheteMl > 0 ? (panier.volumeResteMl / panier.volumeAcheteMl) * 100 : 0;

  // Un ratio n'est evaluable que s'il y a quelque chose a evaluer : sans
  // prediction on affiche "—" au lieu d'un faux rouge.
  const boit = panier.verresAlcoolises > 0;
  const achete = panier.volumeAcheteMl > 0;

  return [
    ratio({
      id: 'verres',
      groupe: 'consommation',
      label: 'Verres / buveur / jour',
      aide: 'Le controle principal, celui que tu ressens sur place.',
      valeur: panier.verresAlcoolises / buveurJours,
      cible: cibles.verresParBuveurParJour,
      unite: 'verres',
      evaluable: boit,
      contributeurs: contributeurs(alcoolisees, (x) => x.verres),
    }),
    ratio({
      id: 'alcool-pur',
      groupe: 'consommation',
      label: 'Alcool pur / buveur / jour',
      aide: "La seule echelle qui compare une biere et un whisky coca. Un nombre de verres correct peut cacher un taux d'alcool delirant.",
      valeur: panier.alcoolPurMl / 10 / buveurJours,
      cible: cibles.alcoolPurClParBuveurParJour,
      unite: 'cl',
      evaluable: boit,
      contributeurs: contributeurs(alcoolisees, (x) => x.alcoolPurMl),
    }),
    ratio({
      id: 'soft',
      groupe: 'consommation',
      label: 'Sans alcool / non-buveur / jour',
      aide: "Les non-buveurs boivent aussi. Sans une boisson sans alcool dans ta selection, ils n'ont rien.",
      valeur: panier.volumeSoftMl / 1000 / (nonBuveurs * jours),
      cible: cibles.softLParNonBuveurParJour,
      unite: 'L',
      sens: 'min',
      // Sans non-buveur, la question ne se pose pas.
      evaluable: nonBuveurs > 0 && panier.verresTotal > 0,
    }),
    ratio({
      id: 'diluant',
      groupe: 'equilibre',
      label: 'Diluant / alcool fort',
      aide: "S'il est trop bas, tu manqueras de coca et de jus a 1h du matin. Le piege classique.",
      valeur:
        panier.volumeSpiritueuxMl > 0 ? panier.volumeDiluantMl / panier.volumeSpiritueuxMl : 0,
      cible: cibles.ratioDiluantSpiritueux,
      unite: 'x',
      sens: 'min',
      // La biere et le vin ne se coupent pas : les inclure ecraserait le ratio.
      evaluable: panier.volumeSpiritueuxMl > 0,
    }),
    ratio({
      id: 'dominante',
      groupe: 'equilibre',
      label: 'Part de la boisson dominante',
      aide: "Une seule boisson qui ecrase tout, et ceux qui ne l'aiment pas repartent tot.",
      valeur: dominante.part,
      cible: cibles.partDominanteMaxPct,
      unite: '%',
      sens: 'max',
      evaluable: boit,
      contributeurs: dominante.part > 0 ? [{ nom: dominante.nom, part: dominante.part }] : [],
    }),
    ratio({
      id: 'liquide',
      groupe: 'logistique',
      label: 'Liquide servi / personne / jour',
      aide: 'Place au frigo, transport, poubelles.',
      valeur: panier.volumeServiMl / 1000 / personneJours,
      cible: cibles.liquideLParPersonneParJour,
      unite: 'L',
      evaluable: panier.verresTotal > 0,
    }),
    ratio({
      id: 'reste',
      groupe: 'logistique',
      label: 'Reste sur les bras',
      aide: 'Ce que tu rapportes a la maison. Baisse les quantites forcees pour le reduire.',
      valeur: restePct,
      cible: cibles.restePctMax,
      unite: '%',
      sens: 'max',
      evaluable: achete,
    }),
    ratio({
      id: 'references',
      groupe: 'logistique',
      label: 'References a acheter',
      aide: "Chaque reference en plus, c'est un rayon de plus et un oubli possible.",
      valeur: panier.lignes.length,
      cible: cibles.referencesMax,
      unite: '',
      sens: 'max',
      evaluable: achete,
    }),
    ratio({
      id: 'budget',
      groupe: 'argent',
      label: 'Budget / personne / jour',
      aide: 'Bouteilles plaisir et materiel inclus.',
      valeur: panier.coutTotal / personneJours,
      cible: cibles.budgetParPersonneParJour,
      unite: '€',
      evaluable: achete,
    }),
    ratio({
      id: 'part-alcool',
      groupe: 'argent',
      label: "Part de l'alcool dans le budget",
      aide: "Trop bas, l'argent part dans les softs et le materiel plutot que dans les verres.",
      valeur: panier.coutTotal > 0 ? (panier.coutAlcool / panier.coutTotal) * 100 : 0,
      cible: cibles.partAlcoolBudgetPct,
      unite: '%',
      evaluable: achete,
    }),
  ];
}

/**
 * Les problemes qu'un ratio ne sait pas dire : il manque un materiel, une
 * bouteille ne passera pas la nuit, une quantite forcee est insuffisante.
 */
export function calculerAlertes(cadre: Cadre, panier: Panier, prixTireuse: number): Alerte[] {
  const alertes: Alerte[] = [];

  if (panier.besoinTireuse && prixTireuse <= 0) {
    alertes.push({
      id: 'tireuse',
      niveau: 'ko',
      message:
        "Un fut pression est prevu mais aucune tireuse n'est budgetee : renseigne son prix dans la liste de courses.",
    });
  }

  if (!panier.besoinTireuse && prixTireuse > 0) {
    alertes.push({
      id: 'tireuse-inutile',
      niveau: 'warn',
      message: "Tu payes une tireuse alors qu'aucun fut pression n'est prevu.",
    });
  }

  const manquants = panier.lignes.filter((x) => x.resteMl < 0);
  if (manquants.length > 0) {
    alertes.push({
      id: 'manque',
      niveau: 'ko',
      message: `Quantite forcee insuffisante : ${manquants.map((x) => x.produit.nom).join(', ')}.`,
    });
  }

  if (cadre.jours > 1) {
    const perissables = panier.lignes.filter((x) => !x.produit.seConserve && x.resteMl > 0);
    if (perissables.length > 0) {
      alertes.push({
        id: 'conservation',
        niveau: 'warn',
        message: `Ne se garde pas d'un jour a l'autre une fois ouvert : ${perissables
          .map((x) => x.produit.nom)
          .join(', ')}.`,
      });
    }
  }

  if (panier.verresTotal > 0 && panier.volumeSoftMl === 0 && nombreNonBuveurs(cadre) > 0) {
    alertes.push({
      id: 'sans-soft',
      niveau: 'ko',
      message: `${nombreNonBuveurs(cadre)} invite(s) ne boivent pas d'alcool et rien n'est prevu pour eux.`,
    });
  }

  return alertes;
}

interface EntreeRatio {
  id: string;
  groupe: GroupeRatio;
  label: string;
  aide: string;
  valeur: number;
  cible: number;
  unite: string;
  sens?: Ratio['sens'];
  evaluable: boolean;
  contributeurs?: Ratio['contributeurs'];
}

function ratio(entree: EntreeRatio): Ratio {
  const valeur = Number.isFinite(entree.valeur) ? entree.valeur : 0;
  const sens = entree.sens ?? 'cible';
  return {
    id: entree.id,
    groupe: entree.groupe,
    label: entree.label,
    aide: entree.aide,
    valeur,
    cible: entree.cible,
    unite: entree.unite,
    sens,
    etat: entree.evaluable ? etatDe(valeur, entree.cible, sens) : 'vide',
    ecartPct: entree.cible > 0 ? ((valeur - entree.cible) / entree.cible) * 100 : 0,
    contributeurs: entree.contributeurs ?? [],
  };
}

function partDominante(panier: Panier): { nom: string; part: number } {
  if (panier.verresAlcoolises <= 0) return { nom: '', part: 0 };
  const tete = panier.resumeBoissons.filter((x) => x.alcoolisee)[0];
  if (!tete) return { nom: '', part: 0 };
  return { nom: tete.nom, part: (tete.verres / panier.verresAlcoolises) * 100 };
}

/** Les 3 boissons qui pesent le plus, pour savoir quoi corriger. */
function contributeurs(
  resumes: readonly Panier['resumeBoissons'][number][],
  mesure: (x: Panier['resumeBoissons'][number]) => number,
) {
  const total = resumes.reduce((somme, x) => somme + mesure(x), 0);
  if (total <= 0) return [];
  return resumes
    .map((x) => ({ nom: x.nom, part: (mesure(x) / total) * 100 }))
    .filter((x) => x.part >= 5)
    .sort((a, b) => b.part - a.part)
    .slice(0, 3);
}
