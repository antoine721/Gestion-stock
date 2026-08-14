import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autorise, chargerParticipants, nouvelId, sql } from '../../_db';

/** POST /api/events/:code/participants — je me declare comme co-organisateur. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!autorise(req)) {
    return res.status(401).json({ erreur: 'Mot de passe incorrect' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const code = String(req.query['code'] ?? '');
  const nom = String(req.body?.nom ?? '').trim();
  if (!nom) return res.status(400).json({ erreur: 'Prenom manquant' });

  // Deux personnes ne peuvent pas porter le meme prenom : on retomberait sur le
  // meme onglet sans savoir laquelle on edite. Revenir avec le meme prenom
  // reprend donc simplement sa propre ligne, depuis n'importe quel appareil.
  const existants = await chargerParticipants(code);
  const doublon = existants.find((x) => x.nom.toLowerCase() === nom.toLowerCase());
  if (doublon) return res.status(200).json({ id: doublon.id, nom: doublon.nom, deja: true });

  const id = nouvelId();
  await sql`
    insert into participants (id, evenement_code, nom, effectifs)
    values (${id}, ${code}, ${nom}, '[]'::jsonb)
  `;

  return res.status(201).json({ id, nom, deja: false });
}
