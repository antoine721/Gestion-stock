import { BOISSONS } from './catalogue';
import {
  FAMILLES_ALCOOL,
  FAMILLE_PAR_GOUT,
  LIBELLE_BOISSON_AIMEE,
  PLAFOND_TEAM,
  VERRES_PAR_FAMILLE,
} from './preferences';
import { ConsommationType, GoutBoisson, Invite, PersonneType } from './models';

/**
 * Interpreter une declaration.
 *
 * Un invite dit ce qu'il aime et a quel rythme il boit, avec ses mots. Ce
 * module traduit ca en verres par jour et par boisson, puis cherche le profil
 * de consommation existant qui s'en approche le plus.
 *
 * Rien n'est applique tout seul : la proposition attend un clic. C'est
 * volontaire — un curseur pousse trop vite ne doit pas changer les courses.
 * D'ou aussi les garde-fous : on prend le milieu de chaque fourchette, on
 * respecte le plafond de l'equipe choisie, et on signale ce qui sort des
 * clous plutot que de le lisser en silence.
 */

/** En dessous, la fiche ne pese rien au bar : ca vaut le coup de demander. */
const SEUIL_BAS = 1;

/** Au-dessus, la declaration devient invraisemblable sur une seule soiree. */
const SEUIL_HAUT = 12;

/** Correspondance jugee bonne : au-dela, le profil colle vraiment. */
const SEUIL_BON_MATCH = 70;

/**
 * Les boissons du catalogue qui portent chaque gout declare. Un gout sans
 * equivalent (le cidre, la tequila) ne se traduit pas en verres : il est
 * signale a l'organisateur plutot que rabattu sur une boisson approchante.
 */
const BOISSONS_PAR_GOUT: Record<string, string[]> = {
  biere: ['biere'],
  'vin-rouge': ['vin-rouge'],
  'vin-blanc': ['vin-blanc'],
  'vin-rose': ['rose'],
  spritz: ['spritz'],
  rhum: ['rhum-coca', 'mojito'],
  captain: ['captain-coca'],
  vodka: ['vodka-orange', 'vodka-redbull'],
  gin: ['gin-tonic'],
  whisky: ['whisky-coca', 'whisky-sec'],
  tequila: [],
  pastis: ['ricard'],
  get: ['get-limonade'],
  jager: ['jagger-shot'],
};

const CATALOGUE = new Set(BOISSONS.map((x) => x.id));

/** Les boissons du catalogue qui existent vraiment pour un gout donne. */
function boissonsDuGout(goutId: string): string[] {
  return (BOISSONS_PAR_GOUT[goutId] ?? []).filter((x) => CATALOGUE.has(x));
}

/** Les gouts qu'on ne sait pas traduire en boissons du catalogue. */
export function goutsIntraduisibles(gouts: readonly GoutBoisson[]): string[] {
  return gouts
    .filter((x) => boissonsDuGout(x.boissonId).length === 0)
    .map((x) => LIBELLE_BOISSON_AIMEE.get(x.boissonId) ?? x.boissonId);
}

export type GraviteAlerte = 'info' | 'attention';

export interface AlerteInterpretation {
  gravite: GraviteAlerte;
  texte: string;
}

export interface Interpretation {
  /** La consommation estimee, prete a devenir un profil. */
  consommation: ConsommationType[];
  /** Total de verres par jour, tous alcools confondus. */
  verresParJour: number;
  /** Ce qui merite un oeil humain avant de valider. */
  alertes: AlerteInterpretation[];
  /** Les profils existants, du plus proche au plus lointain. */
  correspondances: Correspondance[];
  /** Le meilleur profil, s'il colle assez pour etre propose. */
  meilleur?: Correspondance;
}

export interface Correspondance {
  personneType: PersonneType;
  /** 0 a 100 : a quel point le profil colle a l'estimation. */
  score: number;
}

/** Une declaration vide ne s'interprete pas : rien a proposer. */
export function aDeclareQuelqueChose(invite: Invite): boolean {
  return (
    invite.team !== '' ||
    invite.autreAlcool.trim() !== '' ||
    invite.boissonsAimees.some((x) => x.intensite > 0) ||
    FAMILLES_ALCOOL.some((famille) => invite.niveaux[famille.id] !== 'aucun')
  );
}

/**
 * Traduit les gouts declares en verres par jour et par boisson du catalogue.
 * Les verres d'une famille se repartissent entre les boissons aimees, au
 * prorata de l'intensite du gout.
 */
export function estimerConsommation(invite: Invite): ConsommationType[] {
  const plafond = invite.team === '' ? Number.POSITIVE_INFINITY : PLAFOND_TEAM[invite.team];
  if (plafond === 0) return [];

  // Seuls les gouts traduisibles portent des verres : les autres sont
  // signales a part, pour que rien ne se perde en silence.
  const gouts = invite.boissonsAimees.filter(
    (x) => x.intensite > 0 && boissonsDuGout(x.boissonId).length > 0,
  );

  const budgets: [number, typeof gouts][] = FAMILLES_ALCOOL.map((famille) => [
    VERRES_PAR_FAMILLE[famille.id][invite.niveaux[famille.id]],
    gouts.filter((x) => FAMILLE_PAR_GOUT.get(x.boissonId) === famille.id),
  ]);

  // Le plafond de l'equipe s'applique au total, puis se repercute a la baisse
  // sur chaque famille : c'est la promesse que la personne a faite.
  const total = budgets.reduce(
    (somme, [verres, choisis]) => somme + (choisis.length ? verres : 0),
    0,
  );
  const facteur = total > plafond && total > 0 ? plafond / total : 1;

  const parBoisson = new Map<string, number>();
  for (const [verres, choisis] of budgets) {
    if (choisis.length === 0 || verres <= 0) continue;
    const poids = choisis.reduce((somme, x) => somme + x.intensite, 0);
    for (const gout of choisis) {
      const part = (verres * facteur * gout.intensite) / poids;
      const boissons = boissonsDuGout(gout.boissonId);
      for (const boissonId of boissons) {
        parBoisson.set(boissonId, (parBoisson.get(boissonId) ?? 0) + part / boissons.length);
      }
    }
  }

  return [...parBoisson.entries()]
    .map(([boissonId, verres]) => ({ boissonId, verresParJour: arrondi(verres) }))
    .filter((x) => x.verresParJour > 0)
    .sort((a, b) => b.verresParJour - a.verresParJour);
}

function arrondi(valeur: number): number {
  return Math.round(valeur * 2) / 2;
}

/**
 * Compare l'estimation a un profil existant. Le score tombe quand les volumes
 * different ET quand les boissons ne sont pas les memes : deux personnes qui
 * boivent cinq verres de choses opposees ne se ressemblent pas.
 */
export function scorerProfil(
  estimation: readonly ConsommationType[],
  personneType: PersonneType,
): number {
  const attendu = new Map(estimation.map((x) => [x.boissonId, x.verresParJour]));
  const propose = new Map(personneType.consommation.map((x) => [x.boissonId, x.verresParJour]));
  const toutes = new Set([...attendu.keys(), ...propose.keys()]);
  if (toutes.size === 0) return 100;

  let ecart = 0;
  let volume = 0;
  for (const boissonId of toutes) {
    const a = attendu.get(boissonId) ?? 0;
    const b = propose.get(boissonId) ?? 0;
    ecart += Math.abs(a - b);
    volume += Math.max(a, b);
  }
  if (volume === 0) return 100;
  return Math.max(0, Math.round((1 - ecart / volume) * 100));
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

  const plafond = invite.team === '' ? Number.POSITIVE_INFINITY : PLAFOND_TEAM[invite.team];
  const brut = FAMILLES_ALCOOL.reduce(
    (somme, famille) => somme + VERRES_PAR_FAMILLE[famille.id][invite.niveaux[famille.id]],
    0,
  );
  if (Number.isFinite(plafond) && brut > plafond && plafond > 0) {
    alertes.push({
      gravite: 'info',
      texte: `Le rythme declare depasse le plafond de son equipe : ramene a ${plafond} verres/jour.`,
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

/**
 * L'interpretation complete d'une fiche : ce qu'on estime, ce qui cloche, et
 * les profils qui s'en approchent. `meilleur` n'est rempli que si un profil
 * colle assez pour meriter un bouton « valider ».
 */
export function interpreter(
  invite: Invite,
  personnesTypes: readonly PersonneType[],
): Interpretation {
  const consommation = estimerConsommation(invite);
  const verresParJour = arrondi(consommation.reduce((somme, x) => somme + x.verresParJour, 0));
  const correspondances = personnesTypes
    .map((personneType) => ({ personneType, score: scorerProfil(consommation, personneType) }))
    .sort((a, b) => b.score - a.score);

  const meilleur = correspondances[0];
  return {
    consommation,
    verresParJour,
    alertes: alerterSurEstimation(invite, consommation),
    correspondances,
    meilleur: meilleur && meilleur.score >= SEUIL_BON_MATCH ? meilleur : undefined,
  };
}

export { SEUIL_BAS, SEUIL_HAUT, SEUIL_BON_MATCH };
