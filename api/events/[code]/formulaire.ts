import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { chargerEvenement, sql } from '../../_db';

/**
 * Le formulaire invite, SANS mot de passe : c'est le seul endpoint public de
 * l'app. Un invite recoit le lien /f/:code, remplit sa fiche, et la reponse
 * atterrit dans partage.reponsesFormulaire. L'ecriture passe par un jsonb_set
 * atomique cote SQL : deux invites qui repondent en meme temps ne s'ecrasent
 * pas, et un organisateur qui sauvegarde le partage non plus... a condition
 * qu'il ne soit pas en train d'ecrire lui-meme la meme cle.
 */

/** Longueur max d'un champ libre : de quoi ecrire, pas de quoi spammer. */
const MAX_CHAMP = 500;
const MAX_REPONSES = 300;

const REGIMES = new Set([
  'omnivore',
  'vegetarien',
  'vegan',
  'sans-gluten',
  'sans-lactose',
  'halal',
  'casher',
]);

const HEBERGEMENTS = new Set(['a-definir', 'sur-place', 'tente', 'rentre']);

function champ(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, MAX_CHAMP) : '';
}

const NIVEAUX = new Set(['aucun', 'peu', 'moyen', 'beaucoup', 'abuse']);

const TEAMS = new Set(['chameau', 'degustation', 'croisiere', 'bateau-ivre']);

/** Les gouts et les coups de main : des listes d'identifiants courts, bornees. */
function identifiants(valeur: unknown, max: number): string[] {
  if (!Array.isArray(valeur)) return [];
  const vus = new Set<string>();
  for (const brut of valeur.slice(0, max)) {
    const id = champ(brut).slice(0, 40);
    if (id) vus.add(id);
  }
  return [...vus];
}

/**
 * La conso declaree : des paires boisson / verres par jour, bornees. Purement
 * indicative cote produit — mais on la valide comme le reste, c'est la seule
 * entree publique de l'app.
 */
function consommations(valeur: unknown): { boissonId: string; verresParJour: number }[] {
  if (!Array.isArray(valeur)) return [];
  return valeur
    .slice(0, 40)
    .map((x) => {
      const brut = x as { boissonId?: unknown; verresParJour?: unknown };
      const boissonId = champ(brut?.boissonId).slice(0, 60);
      const verres = Number(brut?.verresParJour);
      return {
        boissonId,
        verresParJour: Number.isFinite(verres) ? Math.min(30, Math.max(0, verres)) : 0,
      };
    })
    .filter((x) => x.boissonId.length > 0 && x.verresParJour > 0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query['code'] ?? '');
  const evenement = await chargerEvenement(code);
  if (!evenement) return res.status(404).json({ erreur: 'Evenement introuvable' });

  // GET : juste de quoi afficher la page publique, rien de sensible.
  if (req.method === 'GET') {
    const partage = evenement.partage as {
      nom?: unknown;
      jours?: unknown;
      infos?: { lieu?: unknown; debut?: unknown; fin?: unknown; description?: unknown };
    } | null;
    const texte = (valeur: unknown) => (typeof valeur === 'string' ? valeur.slice(0, 500) : '');
    return res.status(200).json({
      nom: typeof partage?.nom === 'string' ? partage.nom : 'Un evenement',
      jours: typeof partage?.jours === 'number' ? partage.jours : 1,
      lieu: texte(partage?.infos?.lieu),
      debut: texte(partage?.infos?.debut),
      fin: texte(partage?.infos?.fin),
      description: texte(partage?.infos?.description),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ erreur: 'Methode non autorisee' });
  }

  const corps = (req.body ?? {}) as Record<string, unknown>;
  const prenom = champ(corps['prenom']);
  if (!prenom) return res.status(400).json({ erreur: 'Le prenom est obligatoire' });

  const partage = evenement.partage as { reponsesFormulaire?: unknown[] } | null;
  if ((partage?.reponsesFormulaire?.length ?? 0) >= MAX_REPONSES) {
    return res.status(429).json({ erreur: 'Trop de reponses pour cet evenement' });
  }

  const accompagnants = Number(corps['accompagnants']);
  const regime = champ(corps['regime']);
  const logistiqueBrute = (corps['logistique'] ?? {}) as Record<string, unknown>;
  const hebergement = champ(logistiqueBrute['hebergement']);
  const placesVoiture = Number(logistiqueBrute['placesVoiture']);
  const niveauBasiques = champ(corps['niveauBasiques']);
  const niveauSpiritueux = champ(corps['niveauSpiritueux']);
  const team = champ(corps['team']);
  const reponse = {
    id: randomBytes(12).toString('hex'),
    prenom,
    nom: champ(corps['nom']),
    invitePar: champ(corps['invitePar']),
    accompagnants: Number.isFinite(accompagnants)
      ? Math.min(20, Math.max(0, Math.round(accompagnants)))
      : 0,
    regime: REGIMES.has(regime) ? regime : 'omnivore',
    allergies: champ(corps['allergies']),
    preferencesBoissons: champ(corps['preferencesBoissons']),
    envies: champ(corps['envies']),
    recommandations: champ(corps['recommandations']),
    commentaire: champ(corps['commentaire']),
    consommations: consommations(corps['consommations']),
    stylesMusicaux: champ(corps['stylesMusicaux']),
    surnom: champ(corps['surnom']),
    boissonsAimees: identifiants(corps['boissonsAimees'], 30),
    niveauBasiques: NIVEAUX.has(niveauBasiques) ? niveauBasiques : 'aucun',
    niveauSpiritueux: NIVEAUX.has(niveauSpiritueux) ? niveauSpiritueux : 'aucun',
    team: TEAMS.has(team) ? team : '',
    servicesPreferes: identifiants(corps['servicesPreferes'], 20),
    logistique: {
      permis: logistiqueBrute['permis'] === true,
      vehicule: logistiqueBrute['vehicule'] === true,
      tente: logistiqueBrute['tente'] === true,
      sejourComplet: logistiqueBrute['sejourComplet'] !== false,
      placesVoiture: Number.isFinite(placesVoiture)
        ? Math.min(9, Math.max(0, Math.round(placesVoiture)))
        : 0,
      chercheCovoiturage: logistiqueBrute['chercheCovoiturage'] === true,
      hebergement: HEBERGEMENTS.has(hebergement) ? hebergement : 'a-definir',
      arrivee: champ(logistiqueBrute['arrivee']),
      depart: champ(logistiqueBrute['depart']),
      materielApporte: champ(logistiqueBrute['materielApporte']),
      besoins: champ(logistiqueBrute['besoins']),
    },
    creeLe: new Date().toISOString(),
  };

  await sql`
    update evenements
    set partage = jsonb_set(
          partage,
          '{reponsesFormulaire}',
          coalesce(partage->'reponsesFormulaire', '[]'::jsonb) || ${JSON.stringify(reponse)}::jsonb
        ),
        maj_le = now()
    where code = ${code}
  `;

  return res.status(201).json({ ok: true });
}
