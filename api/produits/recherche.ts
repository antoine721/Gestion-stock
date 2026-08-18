import type { VercelRequest, VercelResponse } from '@vercel/node';
import { autorise } from '../_db';

/**
 * Recherche de produits sur Open Food Facts.
 *
 * Pourquoi passer par le serveur alors que l'API d'OFF est publique et ouverte
 * au navigateur ? Pour deux raisons qui ne se contournent pas :
 *
 * 1. OFF demande un User-Agent descriptif et bloque le trafic anonyme. Or
 *    `User-Agent` est un en-tete interdit au `fetch` du navigateur : une page
 *    ne PEUT pas le poser. Seul un appel serveur le peut.
 * 2. La recherche est l'endpoint le plus limite d'OFF (quelques requetes par
 *    minute et par IP). Une barre de recherche qui interroge a chaque frappe
 *    l'epuiserait en trois mots. Ici, un cache memoire absorbe les repetitions
 *    — et sur Vercel tout le monde sort par les memes IP, donc le budget est
 *    commun : c'est un bien partage, pas un quota personnel.
 *
 * On ne renvoie que ce qui sert a choisir : nom, marque, photo. Ni prix ni
 * quantite — ils dependent du magasin et du nombre d'invites, c'est
 * l'organisateur qui les pose.
 */

const CONTACT = process.env['OFF_CONTACT'] ?? 'contact@vialcrm.app';
const UA = `Vialcrm/1.0 (${CONTACT})`;

/** Assez pour choisir, assez court pour rester lisible sur un telephone. */
const RESULTATS = 12;

/** Au-dela, ce n'est plus une recherche : on refuse plutot que d'appeler OFF. */
const REQUETE_MIN = 2;
const REQUETE_MAX = 60;

/** Une recherche identique ne repart pas sur le reseau pendant ce delai. */
const CACHE_MS = 10 * 60 * 1000;

interface Resultat {
  code: string;
  nom: string;
  marque: string;
  imageUrl: string;
}

/**
 * Cache de module : il survit aux invocations tant que la lambda reste chaude.
 * C'est exactement le cas d'usage d'une barre de recherche — les memes mots
 * reviennent sans arret.
 */
const cache = new Map<string, { le: number; resultats: Resultat[] }>();

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

/** Les produits d'OFF, ramenes a ce dont la vignette a besoin. */
function normaliser(produits: unknown): Resultat[] {
  if (!Array.isArray(produits)) return [];
  const vus = new Set<string>();
  const resultats: Resultat[] = [];
  for (const brut of produits) {
    const p = (brut ?? {}) as Record<string, unknown>;
    const code = texte(p['code']);
    const nom = texte(p['product_name_fr']) || texte(p['product_name']);
    // Sans nom, la vignette n'a rien a montrer : le resultat ne sert a rien.
    if (!nom || vus.has(code || nom)) continue;
    vus.add(code || nom);
    resultats.push({
      code,
      nom,
      marque: texte(p['brands']).split(',')[0]?.trim() ?? '',
      imageUrl:
        texte(p['image_front_small_url']) ||
        texte(p['image_small_url']) ||
        texte(p['image_front_url']),
    });
    if (resultats.length >= RESULTATS) break;
  }
  return resultats;
}

async function interroger(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    // Une recherche qui traine plus de 6 s ne sert plus a rien : l'utilisateur
    // a deja tape autre chose.
    signal: AbortSignal.timeout(6000),
  });
}

/**
 * Deux moteurs, dans cet ordre : le moteur de recherche dedie d'OFF, rapide,
 * puis l'ancienne recherche du site, plus lente mais toujours la. Si le
 * premier change ou tombe, la barre de recherche continue de marcher.
 */
async function chercher(requete: string): Promise<Resultat[]> {
  const q = encodeURIComponent(requete);

  try {
    const reponse = await interroger(
      `https://search.openfoodfacts.org/search?q=${q}&page_size=${RESULTATS}&lang=fr`,
    );
    if (reponse.ok) {
      const corps = (await reponse.json()) as { hits?: unknown };
      const resultats = normaliser(corps.hits);
      if (resultats.length > 0) return resultats;
    }
  } catch {
    // Moteur indisponible ou trop lent : on tente l'ancien.
  }

  const reponse = await interroger(
    `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${q}` +
      `&search_simple=1&action=process&json=1&page_size=${RESULTATS}` +
      `&fields=code,product_name,product_name_fr,brands,image_front_small_url,image_small_url`,
  );
  if (!reponse.ok) throw new Error(`Open Food Facts a repondu ${reponse.status}`);
  const corps = (await reponse.json()) as { products?: unknown };
  return normaliser(corps.products);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!autorise(req)) return res.status(401).json({ erreur: 'Mot de passe invalide' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const requete = String(req.query['q'] ?? '')
    .trim()
    .slice(0, REQUETE_MAX);
  if (requete.length < REQUETE_MIN) return res.status(200).json({ resultats: [] });

  const cle = requete.toLowerCase();
  const enCache = cache.get(cle);
  if (enCache && Date.now() - enCache.le < CACHE_MS) {
    return res.status(200).json({ resultats: enCache.resultats });
  }

  try {
    const resultats = await chercher(requete);
    cache.set(cle, { le: Date.now(), resultats });
    // Le navigateur garde aussi sa copie : revenir en arriere ne recoute rien.
    res.setHeader('Cache-Control', 'private, max-age=600');
    return res.status(200).json({ resultats });
  } catch (erreur) {
    // La recherche est un confort : si elle tombe, la saisie a la main reste.
    return res.status(502).json({
      erreur: erreur instanceof Error ? erreur.message : 'Recherche indisponible',
      resultats: [],
    });
  }
}
