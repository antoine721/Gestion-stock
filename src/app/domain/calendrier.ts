/**
 * La geometrie d'une vue calendrier : ou poser chaque bloc sur une grille
 * heures x jours.
 *
 * Le module ne connait ni les missions ni les sets DJ — il ne manipule que des
 * intervalles. C'est ce qui permet au programme et a la regie musicale de
 * partager exactement la meme grille, et de la tester sans Angular.
 *
 * Les heures sont du texte saisi a la main (« 18:30 », « 18h30 », « 21 ») :
 * on les lit avec indulgence, et ce qui ne ressemble a rien part dans les
 * blocs « a caler » plutot que d'atterrir a minuit.
 */

/** Ce qu'il faut savoir d'un bloc pour le placer : son jour et ses heures. */
export interface EntreeCalendrier {
  id: string;
  jour: number;
  debut: string;
  fin: string;
}

export interface PlaceCalendrier {
  id: string;
  jour: number;
  /** Position du haut du bloc, en % de la hauteur de la grille. */
  hautPct: number;
  hauteurPct: number;
  /**
   * Rang du bloc et largeur de la portee quand plusieurs se chevauchent : deux
   * ateliers en meme temps se partagent la largeur du jour au lieu de se
   * recouvrir.
   */
  colonne: number;
  colonnes: number;
}

export interface LigneHeure {
  /** Minutes depuis minuit du premier jour ; peut depasser 24 h. */
  minute: number;
  libelle: string;
  hautPct: number;
}

export interface GrilleCalendrier {
  minuteDebut: number;
  minuteFin: number;
  heures: LigneHeure[];
  places: PlaceCalendrier[];
  /** Les entrees sans heure lisible : elles restent hors de la grille. */
  sansHeure: string[];
}

/** Un creneau sans heure de fin dure une heure : de quoi le voir, sans mentir. */
const DUREE_PAR_DEFAUT = 60;

/**
 * En dessous, la grille est si serree qu'elle ne raconte plus rien : un seul
 * creneau d'un quart d'heure donnerait une bande sans repere. On l'etire, sans
 * plus — remplir la journee entiere de cases vides ne vaudrait pas mieux.
 */
const AMPLITUDE_MIN = 3 * 60;

/** La fenetre d'une journee de festival, quand rien n'est encore a l'heure. */
const FENETRE_PAR_DEFAUT = { debut: 12 * 60, fin: 24 * 60 };

const JOUR = 24 * 60;

/**
 * « 18:30 », « 18h30 », « 21 » -> minutes depuis minuit. Null si le texte ne
 * ressemble pas a une heure : mieux vaut un bloc a caler qu'un bloc range au
 * hasard.
 */
export function enMinutes(heure: string): number | null {
  const trouve = /^\s*(\d{1,2})\s*(?:[:hH.]\s*(\d{1,2}))?\s*$/.exec(heure);
  if (!trouve) return null;
  const heures = Number(trouve[1]);
  const minutes = trouve[2] === undefined ? 0 : Number(trouve[2]);
  if (heures > 23 || minutes > 59) return null;
  return heures * 60 + minutes;
}

/** « 25:30 » de grille se lit « 01:30 » : la nuit appartient encore a la soiree. */
function libelleHeure(minute: number): string {
  const dansLaJournee = ((minute % JOUR) + JOUR) % JOUR;
  return `${String(Math.floor(dansLaJournee / 60)).padStart(2, '0')}:00`;
}

interface Intervalle {
  id: string;
  jour: number;
  debut: number;
  fin: number;
}

/**
 * Un set qui finit avant de commencer a passe minuit : « 23:00 → 01:00 » dure
 * deux heures, il ne remonte pas le temps. La grille s'etire alors au-dela de
 * 24 h plutot que de couper le bloc.
 */
function intervalleDe(entree: EntreeCalendrier, debut: number): Intervalle {
  const finBrute = enMinutes(entree.fin);
  const fin =
    finBrute === null ? debut + DUREE_PAR_DEFAUT : finBrute > debut ? finBrute : finBrute + JOUR;
  return { id: entree.id, jour: entree.jour, debut, fin };
}

/**
 * Repartit en colonnes les blocs d'une meme journee qui se chevauchent. Les
 * blocs disjoints gardent toute la largeur : on ne divise que ce qui se
 * marche dessus.
 */
function repartirEnColonnes(intervalles: Intervalle[]): PlaceCalendrier[] {
  const places: PlaceCalendrier[] = [];
  const tries = [...intervalles].sort((a, b) => a.debut - b.debut || a.fin - b.fin);

  let grappe: Intervalle[] = [];
  let finGrappe = -1;

  const viderGrappe = () => {
    if (grappe.length === 0) return;
    // Chaque bloc prend la premiere colonne libre a son heure de debut.
    const finParColonne: number[] = [];
    const rangs = grappe.map((intervalle) => {
      let colonne = finParColonne.findIndex((fin) => fin <= intervalle.debut);
      if (colonne === -1) colonne = finParColonne.length;
      finParColonne[colonne] = intervalle.fin;
      return { intervalle, colonne };
    });
    const colonnes = finParColonne.length;
    for (const { intervalle, colonne } of rangs) {
      places.push({
        id: intervalle.id,
        jour: intervalle.jour,
        hautPct: 0,
        hauteurPct: 0,
        colonne,
        colonnes,
      });
    }
    grappe = [];
    finGrappe = -1;
  };

  for (const intervalle of tries) {
    if (grappe.length > 0 && intervalle.debut >= finGrappe) viderGrappe();
    grappe.push(intervalle);
    finGrappe = Math.max(finGrappe, intervalle.fin);
  }
  viderGrappe();

  return places;
}

/**
 * Pose les entrees sur une grille horaire. L'amplitude se deduit de ce qui est
 * reellement programme : inutile d'afficher la nuit entiere pour trois ateliers
 * d'apres-midi.
 */
export function construireCalendrier(entrees: readonly EntreeCalendrier[]): GrilleCalendrier {
  const sansHeure: string[] = [];
  const intervalles: Intervalle[] = [];

  for (const entree of entrees) {
    const debut = enMinutes(entree.debut);
    if (debut === null) sansHeure.push(entree.id);
    else intervalles.push(intervalleDe(entree, debut));
  }

  let minuteDebut = FENETRE_PAR_DEFAUT.debut;
  let minuteFin = FENETRE_PAR_DEFAUT.fin;
  if (intervalles.length > 0) {
    minuteDebut = Math.floor(Math.min(...intervalles.map((x) => x.debut)) / 60) * 60;
    minuteFin = Math.ceil(Math.max(...intervalles.map((x) => x.fin)) / 60) * 60;
    if (minuteFin - minuteDebut < AMPLITUDE_MIN) minuteFin = minuteDebut + AMPLITUDE_MIN;
  }
  const amplitude = minuteFin - minuteDebut;

  const heures: LigneHeure[] = [];
  for (let minute = minuteDebut; minute <= minuteFin; minute += 60) {
    heures.push({
      minute,
      libelle: libelleHeure(minute),
      hautPct: ((minute - minuteDebut) / amplitude) * 100,
    });
  }

  const parJour = new Map<number, Intervalle[]>();
  for (const intervalle of intervalles) {
    const liste = parJour.get(intervalle.jour);
    if (liste) liste.push(intervalle);
    else parJour.set(intervalle.jour, [intervalle]);
  }

  const positions = new Map(intervalles.map((x) => [x.id, x]));
  const places: PlaceCalendrier[] = [];
  for (const liste of parJour.values()) {
    for (const place of repartirEnColonnes(liste)) {
      const intervalle = positions.get(place.id);
      if (!intervalle) continue;
      places.push({
        ...place,
        hautPct: ((intervalle.debut - minuteDebut) / amplitude) * 100,
        hauteurPct: ((intervalle.fin - intervalle.debut) / amplitude) * 100,
      });
    }
  }

  return { minuteDebut, minuteFin, heures, places, sansHeure };
}
