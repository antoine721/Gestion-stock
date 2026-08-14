import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

/**
 * Acces base. Un evenement = une ligne `evenements` (les reglages communs) et
 * N lignes `participants` (les invites de chacun). Ce decoupage evite qu'Antoine
 * ecrase la saisie de Marie en sauvegardant la sienne.
 */

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL manquant');

export const sql = neon(url);

/** Code d'evenement : c'est lui qui vit dans l'URL partagee. */
export function nouveauCode(): string {
  // Sans voyelles ni caracteres ambigus : le code se dicte au telephone.
  const alphabet = '23456789bcdfghjkmnpqrstvwxz';
  return [...randomBytes(8)].map((x) => alphabet[x % alphabet.length]).join('');
}

export function nouvelId(): string {
  return randomBytes(12).toString('hex');
}

/**
 * Un seul mot de passe pour toute l'app, defini par la variable
 * d'environnement MOT_DE_PASSE. On n'est que quelques-uns : inutile de gerer
 * des comptes, des sessions ou des permissions.
 */
export function autorise(req: VercelRequest): boolean {
  const attendu = process.env['MOT_DE_PASSE'];
  if (!attendu) return false;
  const brut = req.headers['x-mot-de-passe'];
  const fourni = Array.isArray(brut) ? brut[0] : brut;
  return fourni === attendu;
}

export interface LigneEvenement {
  code: string;
  partage: unknown;
}

export async function chargerEvenement(code: string): Promise<LigneEvenement | undefined> {
  const lignes =
    (await sql`select code, partage from evenements where code = ${code}`) as LigneEvenement[];
  return lignes[0];
}

export async function chargerParticipants(code: string) {
  return (await sql`
    select id, nom, effectifs
    from participants
    where evenement_code = ${code}
    order by cree_le
  `) as { id: string; nom: string; effectifs: unknown }[];
}
