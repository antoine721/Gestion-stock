import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  COOKIE_SESSION,
  COOKIE_TRANSIT,
  DUREE_SESSION,
  Transit,
  admis,
  effacerCookie,
  lireCookie,
  poserCookie,
  retourEnErreur,
  signer,
  urlDeBase,
  urlDeRetour,
  verifier,
} from '../_auth';

interface IdentiteGoogle {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  name?: string;
  picture?: string;
}

const EMETTEURS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/**
 * Le id_token arrive directement du serveur de jetons de Google, par une
 * connexion TLS qu'on a ouverte nous-memes : sa signature est deja garantie
 * par le transport. On le lit donc sans aller chercher les cles publiques,
 * mais on verifie quand meme a qui il est destine et quand il expire.
 */
function lireIdentite(idToken: string): IdentiteGoogle | undefined {
  const charge = idToken.split('.')[1];
  if (!charge) return undefined;
  try {
    return JSON.parse(Buffer.from(charge, 'base64url').toString()) as IdentiteGoogle;
  } catch {
    return undefined;
  }
}

/** GET /api/auth/callback — le retour de Google : on echange le code contre une identite. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const transit = verifier<Transit>(lireCookie(req, COOKIE_TRANSIT));
  effacerCookie(req, res, COOKIE_TRANSIT);

  if (req.query['error']) {
    return retourEnErreur(req, res, 'Connexion Google annulee.');
  }
  if (!transit || transit.etat !== String(req.query['state'] ?? '')) {
    return retourEnErreur(req, res, 'Connexion expiree, recommence.');
  }

  const code = String(req.query['code'] ?? '');
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
  if (!code || !clientId || !clientSecret) {
    return retourEnErreur(req, res, "La connexion Google n'est pas configuree sur ce serveur.");
  }

  const echange = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: urlDeRetour(req),
      grant_type: 'authorization_code',
      code_verifier: transit.verifieur,
    }),
  });

  if (!echange.ok) {
    return retourEnErreur(req, res, 'Google a refuse la connexion.');
  }

  const { id_token: idToken } = (await echange.json()) as { id_token?: string };
  const identite = idToken ? lireIdentite(idToken) : undefined;
  const expire = (identite?.exp ?? 0) <= Math.floor(Date.now() / 1000);
  if (!identite || !EMETTEURS.has(identite.iss ?? '') || identite.aud !== clientId || expire) {
    return retourEnErreur(req, res, 'Reponse Google illisible.');
  }

  const email = identite.email ?? '';
  if (!email || identite.email_verified === false) {
    return retourEnErreur(req, res, "Ce compte Google n'a pas d'adresse verifiee.");
  }
  if (!admis(email)) {
    return retourEnErreur(req, res, `${email} n'est pas dans l'equipe d'organisation.`);
  }

  const session = signer(
    {
      email,
      // Le prenom sert a reconnaitre tes invites : il vient desormais du
      // compte Google, on ne le tape plus a la main.
      prenom: (identite.given_name || identite.name || email.split('@')[0] || '').slice(0, 40),
      photo: identite.picture ?? '',
    },
    DUREE_SESSION,
  );
  if (!session) {
    return retourEnErreur(req, res, 'SESSION_SECRET manquant sur ce serveur.');
  }

  poserCookie(req, res, COOKIE_SESSION, session, DUREE_SESSION);
  return res.redirect(302, `${urlDeBase(req)}${transit.retour}`);
}
