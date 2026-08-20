import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autorise, nouveauCode, sql } from './_db';

/**
 * GET  /api/events — la liste des evenements, pour en choisir un.
 * POST /api/events — en creer un.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!autorise(req)) {
    return res.status(401).json({ erreur: 'Connexion requise' });
  }

  if (req.method === 'GET') {
    const evenements = await sql`
      select e.code,
             e.partage->>'nom'  as nom,
             e.cree_le          as "creeLe",
             count(p.id)::int   as organisateurs
      from evenements e
      left join participants p on p.evenement_code = e.code
      group by e.code, e.partage, e.cree_le
      order by e.cree_le desc
    `;
    return res.status(200).json({ evenements });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const { partage } = req.body ?? {};
  if (!partage || typeof partage !== 'object') {
    return res.status(400).json({ erreur: 'Reglages manquants' });
  }

  const code = nouveauCode();
  await sql`
    insert into evenements (code, partage)
    values (${code}, ${JSON.stringify(partage)}::jsonb)
  `;

  return res.status(201).json({ code });
}
