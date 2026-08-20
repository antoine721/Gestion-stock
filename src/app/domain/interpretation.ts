import { BOISSONS } from './catalogue';
import {
  FAMILLES_ALCOOL,
  FAMILLE_PAR_GOUT,
  LIBELLE_BOISSON_AIMEE,
  PLAFOND_TEAM,
} from './preferences';
import { ConsommationType, GoutBoisson, Invite } from './models';

/**
 * Interpreter une declaration.
 *
 * Un invite dit ce qu'il aime et a quel rythme il boit, avec ses mots. Ce
 * module traduit ca en verres par jour et par boisson, puis cherche le profil
 * de consommation existant qui s'en approche le plus.
 *
 * Deux chiffres suffisent, famille par famille : combien de verres par jour,
 * et comment ils se repartissent entre les boissons aimees. Le nombre est
 * declare, pas devine — on ne le rabat sur rien, pas meme sur le plafond de
 * l'equipe : ce qui sort des clous est signale, jamais lisse en silence.
 */

/** On ne coupe pas un verre plus fin que le quart. */
const PAS_VERRE = 0.25;

/** En dessous, la fiche ne pese rien au bar : ca vaut le coup de demander. */
const SEUIL_BAS = 1;

/** Au-dessus, la declaration devient invraisemblable sur une seule soiree. */
const SEUIL_HAUT = 12;

/**
 * La boisson du catalogue que chaque gout fait acheter. Un gout sans
 * equivalent ne se traduit pas en verres : il est signale a l'organisateur
 * plutot que rabattu sur une boisson approchante.
 */
const BOISSON_PAR_GOUT: Record<string, string> = {
  biere: 'biere',
  // Blonde, blanche ou rouge : le catalogue ne connait qu'une biere, et c'est
  // elle qu'on achete dans les trois cas.
  'biere-blonde': 'biere',
  'biere-blanche': 'biere',
  'biere-rouge': 'biere',
  'vin-rouge': 'vin-rouge',
  'vin-blanc': 'vin-blanc',
  'vin-rose': 'rose',
  kir: 'kir',
  spritz: 'spritz',
  rhum: 'rhum',
  captain: 'captain',
  vodka: 'vodka',
  gin: 'gin',
  whisky: 'whisky',
  tequila: 'tequila',
  pastis: 'pastis',
  get: 'get',
  jager: 'jager',
};

const CATALOGUE = new Set(BOISSONS.map((x) => x.id));

/** La boisson du catalogue qui existe vraiment pour un gout donne. */
export function boissonDuGout(goutId: string): string | undefined {
  const boissonId = BOISSON_PAR_GOUT[goutId];
  return boissonId && CATALOGUE.has(boissonId) ? boissonId : undefined;
}

/** Les gouts qu'on ne sait pas traduire en boissons du catalogue. */
export function goutsIntraduisibles(gouts: readonly GoutBoisson[]): string[] {
  return gouts
    .filter((x) => boissonDuGout(x.boissonId) === undefined)
    .map((x) => LIBELLE_BOISSON_AIMEE.get(x.boissonId) ?? x.boissonId);
}

export type GraviteAlerte = 'info' | 'attention';

export interface AlerteInterpretation {
  gravite: GraviteAlerte;
  texte: string;
}

export interface Interpretation {
  /** Ce qu'on prevoit de servir, par jour et par boisson. */
  consommation: ConsommationType[];
  /** Total de verres par jour, tous alcools confondus. */
  verresParJour: number;
  /** Ce qui merite un oeil humain avant de valider. */
  alertes: AlerteInterpretation[];
}

/**
 * Traduit les gouts declares en verres par jour et par boisson du catalogue.
 * Les verres d'une famille se repartissent entre les boissons aimees, au
 * prorata de l'intensite du gout.
 */
export function estimerConsommation(invite: Invite): ConsommationType[] {
  // Le chameau a dit qu'il ne boirait pas une goutte : c'est une reponse, pas
  // un rythme a interpreter.
  if (invite.team === 'chameau') return [];

  const parBoisson = new Map<string, number>();

  for (const famille of FAMILLES_ALCOOL) {
    const verres = Math.max(0, invite.verresParFamille[famille.id] ?? 0);
    if (verres <= 0) continue;

    const gouts = invite.boissonsAimees
      .filter((x) => x.intensite > 0 && FAMILLE_PAR_GOUT.get(x.boissonId) === famille.id)
      .map((x) => ({ boissonId: boissonDuGout(x.boissonId), part: x.intensite }))
      .filter((x): x is { boissonId: string; part: number } => x.boissonId !== undefined);

    // Des verres declares sans aucun gout coche : on ne devine pas quoi
    // acheter, et la fiche le signale a l'organisateur.
    const poids = gouts.reduce((somme, x) => somme + x.part, 0);
    if (poids === 0) continue;

    for (const [boissonId, part] of repartir(verres, gouts, poids)) {
      parBoisson.set(boissonId, (parBoisson.get(boissonId) ?? 0) + part);
    }
  }

  return [...parBoisson.entries()]
    .map(([boissonId, verres]) => ({ boissonId, verresParJour: verres }))
    .filter((x) => x.verresParJour > 0)
    .sort((a, b) => b.verresParJour - a.verresParJour);
}

/**
 * Repartit les verres d'une famille entre ses boissons, au quart de verre.
 * Les quarts perdus par l'arrondi vont aux plus gros restes : la somme rendue
 * fait exactement le nombre declare, sans quoi une famille a quatre gouts
 * perdrait un verre sur quatre en route.
 */
function repartir(
  verres: number,
  gouts: readonly { boissonId: string; part: number }[],
  poids: number,
): Map<string, number> {
  const exacts = gouts.map((x) => ({ ...x, exact: (verres * x.part) / poids }));
  const rendus = exacts.map((x) => ({ ...x, verres: Math.floor(x.exact / PAS_VERRE) * PAS_VERRE }));

  let distribue = rendus.reduce((somme, x) => somme + x.verres, 0);
  const parReste = [...rendus].sort((a, b) => b.exact - b.verres - (a.exact - a.verres));
  for (const x of parReste) {
    if (distribue >= verres - 1e-9) break;
    x.verres += PAS_VERRE;
    distribue += PAS_VERRE;
  }

  const total = new Map<string, number>();
  for (const x of rendus) {
    if (x.verres > 0) total.set(x.boissonId, (total.get(x.boissonId) ?? 0) + x.verres);
  }
  return total;
}

function arrondi(valeur: number): number {
  return Math.round(valeur * 2) / 2;
}

/** Les garde-fous : ce qui doit passer sous les yeux d'un humain. */
export function alerterSurEstimation(
  invite: Invite,
  estimation: readonly ConsommationType[],
): AlerteInterpretation[] {
  const alertes: AlerteInterpretation[] = [];
  const total = estimation.reduce((somme, x) => somme + x.verresParJour, 0);
  const aCocheDesAlcools = invite.boissonsAimees.some((x) => x.intensite > 0);

  if (invite.team === 'chameau' && aCocheDesAlcools) {
    alertes.push({
      gravite: 'attention',
      texte: 'Se dit sans alcool mais a declare aimer des alcools : a confirmer.',
    });
  }

  if (total === 0 && invite.team !== 'chameau' && invite.team !== '') {
    alertes.push({
      gravite: 'info',
      texte: "Rien d'estimable : aucun alcool declare, ou un rythme laisse a zero.",
    });
  }

  if (total > 0 && total < SEUIL_BAS) {
    alertes.push({
      gravite: 'info',
      texte: `Estimation tres basse (${total} verre(s)/jour) : verifie que le rythme declare est bon.`,
    });
  }

  if (total > SEUIL_HAUT) {
    alertes.push({
      gravite: 'attention',
      texte: `Estimation tres haute (${total} verres/jour) : a confirmer avant de commander.`,
    });
  }

  // Le nombre declare fait foi : on ne le rabat pas sur le plafond de
  // l'equipe, on signale l'ecart et l'organisateur tranche.
  const plafond = invite.team === '' ? Number.POSITIVE_INFINITY : PLAFOND_TEAM[invite.team];
  if (Number.isFinite(plafond) && total > plafond && plafond > 0) {
    alertes.push({
      gravite: 'info',
      texte: `Declare ${total} verres/jour, au-dessus des ${plafond} que promet son equipe.`,
    });
  }

  const orphelins = goutsIntraduisibles(invite.boissonsAimees);
  if (orphelins.length > 0) {
    alertes.push({
      gravite: 'info',
      texte: `Aime ${orphelins.join(', ')} : absent du catalogue, a prevoir a la main.`,
    });
  }

  // Ce qu'on a oublie de proposer ne doit pas se perdre au fond d'une fiche.
  if (invite.autreAlcool.trim()) {
    alertes.push({
      gravite: 'info',
      texte: `Demande aussi « ${invite.autreAlcool.trim()} » : hors liste, a prevoir a la main.`,
    });
  }

  return alertes;
}

/** Ce qu'on prevoit pour une fiche, et ce qui cloche dedans. */
export function interpreter(invite: Invite): Interpretation {
  const consommation = estimerConsommation(invite);
  return {
    consommation,
    verresParJour: arrondi(consommation.reduce((somme, x) => somme + x.verresParJour, 0)),
    alertes: alerterSurEstimation(invite, consommation),
  };
}

export { SEUIL_BAS, SEUIL_HAUT };
