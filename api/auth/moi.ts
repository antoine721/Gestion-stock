import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sessionAdmin } from '../_auth';

/** GET /api/auth/moi — qui est connecte sur ce navigateur, vu du serveur. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const session = sessionAdmin(req);
  if (!session) return res.status(401).json({ erreur: 'Non connecte' });

  return res
    .status(200)
    .json({ email: session.email, prenom: session.prenom, photo: session.photo });
}
