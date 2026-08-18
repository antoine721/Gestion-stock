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
 *
 * La pertinence tient a trois reglages, dans cet ordre d'importance :
 * les produits vendus en France d'abord (une base mondiale rend surtout des
 * references qu'on ne trouvera jamais en magasin), les plus scannes ensuite
 * (ce que les gens achetent vraiment, plutot qu'une fiche creee une fois),
 * et enfin ceux qui ont une photo — dans un rayon visuel, une fiche sans
 * image ne sert a rien.
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
  /** Le conditionnement tel qu'OFF l'ecrit : « 1,5 L », « 6 x 33 cl ». */
  conditionnement: string;
}

/** Le pays qu'on privilegie : ce qu'on peut reellement mettre dans un caddie. */
const PAYS = 'en:france';

/** Les champs demandes a OFF : tout le reste est du poids mort sur le reseau. */
const CHAMPS = [
  'code',
  'product_name',
  'product_name_fr',
  'brands',
  'image_front_url',
  'image_front_small_url',
  'image_small_url',
  'quantity',
].join(',');

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
      // La grande image d'abord : la vignette du rayon est trop large pour la
      // miniature de 200 px, qui y remonterait floue.
      imageUrl:
        texte(p['image_front_url']) ||
        texte(p['image_front_small_url']) ||
        texte(p['image_small_url']),
      conditionnement: texte(p['quantity']).slice(0, 40),
    });
    if (resultats.length >= RESULTATS) break;
  }
  return classer(resultats);
}

/**
 * Les produits avec photo passent devant. Le tri d'OFF reste respecte a
 * l'interieur de chaque groupe : on ne fait que repousser ce qui ne se voit
 * pas, sans le jeter — une fiche sans image reste un produit valable.
 */
function classer(resultats: Resultat[]): Resultat[] {
  return [...resultats].sort((a, b) => Number(!!b.imageUrl) - Number(!!a.imageUrl));
}

async function interroger(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    // Une recherche qui traine plus de 6 s ne sert plus a rien : l'utilisateur
    // a deja tape autre chose.
    signal: AbortSignal.timeout(6000),
  });
}

/** Le moteur de recherche dedie d'OFF : le plus rapide des deux. */
async function moteurDedie(requete: string, franceSeulement: boolean): Promise<Resultat[]> {
  const filtre = franceSeulement ? ` countries_tags:${PAYS}` : '';
  const q = encodeURIComponent(requete + filtre);
  const reponse = await interroger(
    `https://search.openfoodfacts.org/search?q=${q}` +
      `&page_size=${RESULTATS}&lang=fr&sort_by=popularity_key&fields=${CHAMPS}`,
  );
  if (!reponse.ok) throw new Error(`Open Food Facts a repondu ${reponse.status}`);
  const corps = (await reponse.json()) as { hits?: unknown };
  return normaliser(corps.hits);
}

/** L'ancienne recherche du site : plus lente, mais elle n'a jamais bouge. */
async function moteurHistorique(requete: string): Promise<Resultat[]> {
  const reponse = await interroger(
    `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(requete)}` +
      `&search_simple=1&action=process&json=1&page_size=${RESULTATS}` +
      `&sort_by=unique_scans_n&fields=${CHAMPS}` +
      `&tagtype_0=countries&tag_contains_0=contains&tag_0=france`,
  );
  if (!reponse.ok) throw new Error(`Open Food Facts a repondu ${reponse.status}`);
  const corps = (await reponse.json()) as { products?: unknown };
  return normaliser(corps.products);
}

/**
 * La cascade de recherche. Elle distingue deux echecs qui n'appellent pas la
 * meme suite : un moteur qui TOMBE se remplace par l'autre, un moteur qui
 * repond VIDE se relance en relachant le filtre pays. Sans cette distinction,
 * une recherche infructueuse couterait deux appels a un moteur deja muet.
 */
async function chercher(requete: string): Promise<Resultat[]> {
  try {
    const enFrance = await moteurDedie(requete, true);
    if (enFrance.length > 0) return enFrance;
    // Rien en France : plutot qu'une liste vide, on elargit une fois. Un
    // produit etranger reste un produit qu'on peut poser dans la liste.
    return await moteurDedie(requete, false);
  } catch {
    // Le moteur dedie est indisponible : l'ancien prend le relais.
    return moteurHistorique(requete);
  }
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
