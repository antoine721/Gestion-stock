import { InfosEvenement } from './models';

/**
 * La fiche d'identite de l'evenement : lieu, dates, description. Les dates
 * sont indicatives — la duree qui pilote le calcul reste `partage.jours` —
 * mais elles datent le planning et disent combien de temps il reste.
 */

export function infosVierges(): InfosEvenement {
  return { lieu: '', debut: '', fin: '', description: '' };
}

function dateLocale(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Minuit du jour donne : les comptes a rebours se font en jours pleins. */
function minuit(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Jours pleins avant le debut : 3 pour « dans trois jours », 0 le jour J,
 * negatif une fois l'evenement commence, null sans date valide.
 */
export function joursAvant(debut: string, aujourdHui: Date): number | null {
  const date = dateLocale(debut);
  if (!date) return null;
  return Math.round((minuit(date) - minuit(aujourdHui)) / JOUR_MS);
}

/** Duree en jours, bornes comprises : du vendredi au dimanche = 3. */
export function dureeEnJours(debut: string, fin: string): number | null {
  const dateDebut = dateLocale(debut);
  const dateFin = dateLocale(fin);
  if (!dateDebut || !dateFin) return null;
  const duree = Math.round((minuit(dateFin) - minuit(dateDebut)) / JOUR_MS) + 1;
  return duree >= 1 ? duree : null;
}

/** La date reelle du jour N du planning (jour 1 = date de debut). */
export function dateDuJour(debut: string, jour: number): Date | null {
  const date = dateLocale(debut);
  if (!date || jour < 1) return null;
  return new Date(minuit(date) + (jour - 1) * JOUR_MS);
}
