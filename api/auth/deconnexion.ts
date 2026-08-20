import type { VercelRequest, VercelResponse } from '@vercel/node';
import { COOKIE_SESSION, effacerCookie } from '../_auth';

/** POST /api/auth/deconnexion — on jette le cookie, cote serveur cette fois. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  effacerCookie(req, res, COOKIE_SESSION);
  return res.status(200).json({ ok: true });
}
