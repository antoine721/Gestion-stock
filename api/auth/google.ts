import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  COOKIE_TRANSIT,
  DUREE_TRANSIT,
  cheminSur,
  couplePkce,
  jeton,
  poserCookie,
  retourEnErreur,
  signer,
  urlDeRetour,
} from '../_auth';

/**
 * GET /api/auth/google — le depart : on envoie le navigateur chez Google.
 *
 * L'etat anti-CSRF et le verifieur PKCE partent dans un cookie signe de dix
 * minutes : c'est la seule chose qu'on a le droit de retrouver au retour.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const clientId = process.env['GOOGLE_CLIENT_ID'];
  if (!clientId || !process.env['GOOGLE_CLIENT_SECRET']) {
    return retourEnErreur(req, res, "La connexion Google n'est pas configuree sur ce serveur.");
  }

  const etat = jeton();
  const { verifieur, defi } = couplePkce();
  const transit = signer(
    { etat, verifieur, retour: cheminSur(req.query['retour'], '/evenements') },
    DUREE_TRANSIT,
  );
  if (!transit) {
    return retourEnErreur(req, res, 'SESSION_SECRET manquant sur ce serveur.');
  }
  poserCookie(req, res, COOKIE_TRANSIT, transit, DUREE_TRANSIT);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', urlDeRetour(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', etat);
  url.searchParams.set('code_challenge', defi);
  url.searchParams.set('code_challenge_method', 'S256');
  // On est plusieurs a partager un ordinateur pendant le festival : mieux vaut
  // que Google demande toujours quel compte utiliser.
  url.searchParams.set('prompt', 'select_account');

  return res.redirect(302, url.toString());
}
