import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autorise, sql } from '../../../_db';

/**
 * PUT / DELETE /api/events/:code/participants/:id
 *
 * Chacun a sa ligne : sauvegarder ma saisie n'ecrase jamais celle des autres.
 * Tout le monde peut editer tout le monde, c'est assume.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!autorise(req)) {
    return res.status(401).json({ erreur: 'Connexion requise' });
  }

  const code = String(req.query['code'] ?? '');
  const id = String(req.query['id'] ?? '');

  if (req.method === 'DELETE') {
    await sql`delete from participants where id = ${id} and evenement_code = ${code}`;
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT, DELETE');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const { nom, effectifs } = req.body ?? {};
  if (typeof nom !== 'string' || !nom.trim()) {
    return res.status(400).json({ erreur: 'Prenom manquant' });
  }
  if (!Array.isArray(effectifs)) {
    return res.status(400).json({ erreur: 'Effectifs invalides' });
  }

  const resultat = await sql`
    update participants
    set nom = ${nom.trim()},
        effectifs = ${JSON.stringify(effectifs)}::jsonb,
        maj_le = now()
    where id = ${id} and evenement_code = ${code}
    returning id
  `;

  if ((resultat as unknown[]).length === 0) {
    return res.status(404).json({ erreur: 'Participant introuvable' });
  }

  return res.status(200).json({ ok: true });
}
