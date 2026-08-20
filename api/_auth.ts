import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * L'entree dans la partie admin : « Continuer avec Google ».
 *
 * Il n'y a toujours pas de table utilisateurs — la liste des gens autorises
 * tient dans une variable d'environnement (ADMINS_GOOGLE). Google dit qui tu
 * es, on verifie que tu es sur la liste, et on repose l'identite dans un
 * cookie signe. Le formulaire public des invites, lui, ne passe jamais par ici.
 */

export const COOKIE_SESSION = 'vialcrm_session';
/** Le cookie qui ne vit que le temps de l'aller-retour vers Google. */
export const COOKIE_TRANSIT = 'vialcrm_oauth';

/** Un mois : on se reconnecte une fois par festival, pas une fois par jour. */
export const DUREE_SESSION = 30 * 24 * 60 * 60;
export const DUREE_TRANSIT = 10 * 60;

export interface SessionAdmin {
  email: string;
  prenom: string;
  photo: string;
  /** Epoch en secondes. */
  exp: number;
}

export interface Transit {
  etat: string;
  verifieur: string;
  retour: string;
}

function maintenant(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Un jeton maison : charge utile en base64url, signature HMAC a cote. On
 * l'emet et on le relit nous-memes, inutile de sortir une bibliotheque JWT.
 */
export function signer(charge: object, dureeSecondes: number): string | undefined {
  const secret = process.env['SESSION_SECRET'];
  if (!secret) return undefined;
  const corps = Buffer.from(
    JSON.stringify({ ...charge, exp: maintenant() + dureeSecondes }),
  ).toString('base64url');
  return `${corps}.${createHmac('sha256', secret).update(corps).digest('base64url')}`;
}

export function verifier<T>(jeton: string | undefined): (T & { exp: number }) | undefined {
  const secret = process.env['SESSION_SECRET'];
  if (!secret || !jeton) return undefined;

  const [corps, signature] = jeton.split('.');
  if (!corps || !signature) return undefined;

  // Comparaison a temps constant : la signature est ce qui empeche de se
  // fabriquer une session.
  const fournie = Buffer.from(signature);
  const attendue = Buffer.from(createHmac('sha256', secret).update(corps).digest('base64url'));
  if (fournie.length !== attendue.length || !timingSafeEqual(fournie, attendue)) return undefined;

  try {
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString()) as T & { exp: number };
    return charge.exp > maintenant() ? charge : undefined;
  } catch {
    return undefined;
  }
}

export function lireCookie(req: VercelRequest, nom: string): string | undefined {
  const brut = req.headers.cookie;
  if (!brut) return undefined;
  for (const morceau of brut.split(';')) {
    const separateur = morceau.indexOf('=');
    if (separateur < 0) continue;
    if (morceau.slice(0, separateur).trim() !== nom) continue;
    return decodeURIComponent(morceau.slice(separateur + 1).trim());
  }
  return undefined;
}

/** En local (vercel dev) on sert en http : un cookie Secure n'y arriverait jamais. */
export function estLocal(req: VercelRequest): boolean {
  const hote = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  return hote.startsWith('localhost') || hote.startsWith('127.0.0.1');
}

export function poserCookie(
  req: VercelRequest,
  res: VercelResponse,
  nom: string,
  valeur: string,
  maxAge: number,
): void {
  const attributs = [
    `${nom}=${encodeURIComponent(valeur)}`,
    'Path=/',
    'HttpOnly',
    // Lax et pas Strict : le retour de Google est une navigation venue d'un
    // autre site, le cookie doit survivre au voyage.
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (!estLocal(req)) attributs.push('Secure');

  const deja = res.getHeader('Set-Cookie');
  const liste = Array.isArray(deja) ? deja.map(String) : deja ? [String(deja)] : [];
  res.setHeader('Set-Cookie', [...liste, attributs.join('; ')]);
}

export function effacerCookie(req: VercelRequest, res: VercelResponse, nom: string): void {
  poserCookie(req, res, nom, '', 0);
}

/**
 * L'origine publique de ce deploiement. Google exige que redirect_uri soit
 * enregistree au caractere pres : chaque domaine servi (prod, preprod) doit
 * figurer dans la console Google. URL_PUBLIQUE force la valeur quand l'URL
 * reelle n'est pas devinable (deploiements de preview aux noms aleatoires).
 */
export function urlDeBase(req: VercelRequest): string {
  const forcee = process.env['URL_PUBLIQUE'];
  if (forcee) return forcee.replace(/\/+$/, '');

  const hote = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  const brut = String(req.headers['x-forwarded-proto'] ?? (estLocal(req) ? 'http' : 'https'));
  return `${brut.split(',')[0]}://${hote}`;
}

export function urlDeRetour(req: VercelRequest): string {
  return `${urlDeBase(req)}/api/auth/callback`;
}

/**
 * La liste blanche : des adresses completes, ou des domaines entiers ecrits
 * « @exemple.com ». Vide, elle refuse tout le monde — on ne veut pas qu'une
 * variable oubliee ouvre l'admin a n'importe quel compte Google.
 */
export function admis(email: string): boolean {
  const liste = (process.env['ADMINS_GOOGLE'] ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (liste.length === 0) return false;

  const compte = email.trim().toLowerCase();
  const domaine = compte.slice(compte.indexOf('@'));
  return liste.some((x) => x === compte || (x.startsWith('@') && x === domaine));
}

/** La session admin de cette requete, si le cookie tient et que l'adresse est toujours admise. */
export function sessionAdmin(req: VercelRequest): SessionAdmin | undefined {
  const charge = verifier<SessionAdmin>(lireCookie(req, COOKIE_SESSION));
  if (!charge?.email || !admis(charge.email)) return undefined;
  return charge;
}

/** PKCE : le secret qu'on garde et l'empreinte qu'on confie a Google. */
export function couplePkce(): { verifieur: string; defi: string } {
  const verifieur = randomBytes(32).toString('base64url');
  return { verifieur, defi: createHash('sha256').update(verifieur).digest('base64url') };
}

export function jeton(): string {
  return randomBytes(16).toString('hex');
}

/** Une redirection vers l'ecran de connexion, avec le message a afficher. */
export function retourEnErreur(req: VercelRequest, res: VercelResponse, message: string): void {
  res.redirect(302, `${urlDeBase(req)}/?erreur=${encodeURIComponent(message)}`);
}

/** Un chemin interne, et rien d'autre : pas question de rediriger vers un autre site. */
export function cheminSur(valeur: unknown, defaut: string): string {
  const chemin = typeof valeur === 'string' ? valeur : '';
  return chemin.startsWith('/') && !chemin.startsWith('//') ? chemin : defaut;
}
