import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autorise, sql } from '../../_db';

/**
 * PUT /api/events/:code/partage — les reglages communs (duree, profils, prix,
 * materiel). Ils sont partages, donc le dernier qui ecrit gagne : a quelques-uns
 * sur une soiree, ca suffit largement.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!autorise(req)) {
    return res.status(401).json({ erreur: 'Connexion requise' });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const partage = req.body?.partage;
  if (!partage || typeof partage !== 'object') {
    return res.status(400).json({ erreur: 'Reglages manquants' });
  }

  await sql`
    update evenements
    set partage = ${JSON.stringify(partage)}::jsonb, maj_le = now()
    where code = ${String(req.query['code'] ?? '')}
  `;

  return res.status(200).json({ ok: true });
}
