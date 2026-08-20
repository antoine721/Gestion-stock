import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autorise, chargerEvenement, chargerParticipants, sql } from '../_db';

/** GET / DELETE /api/events/:code */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!autorise(req)) {
    return res.status(401).json({ erreur: 'Connexion requise' });
  }

  const code = String(req.query['code'] ?? '');

  if (req.method === 'DELETE') {
    await sql`delete from evenements where code = ${code}`;
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const evenement = await chargerEvenement(code);
  if (!evenement) return res.status(404).json({ erreur: 'Evenement introuvable' });

  const participants = await chargerParticipants(code);
  return res.status(200).json({ code, partage: evenement.partage, participants });
}
