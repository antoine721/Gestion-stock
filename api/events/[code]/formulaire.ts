import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { chargerEvenement, chargerParticipants, sql } from '../../_db';

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

function champ(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, MAX_CHAMP) : '';
}

const NIVEAUX = new Set(['aucun', 'peu', 'moyen', 'beaucoup', 'abuse']);

const TEAMS = new Set(['chameau', 'degustation', 'croisiere', 'bateau-ivre']);

const FAMILLES = ['biere', 'vin', 'spiritueux'] as const;

/** L'echelle du curseur de gout : 0 « j'en bois pas » a 4 « je bois que ca ». */
const INTENSITE_MAX = 4;

/** Les coups de main : une liste d'identifiants courts, bornee. */
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
 * Les gouts : une boisson et l'intensite du curseur. Un gout a zero ne dit
 * rien — c'est le defaut du formulaire — donc on ne le stocke pas.
 */
function gouts(valeur: unknown): { boissonId: string; intensite: number }[] {
  if (!Array.isArray(valeur)) return [];
  const vus = new Set<string>();
  const retenus: { boissonId: string; intensite: number }[] = [];
  for (const x of valeur.slice(0, 40)) {
    const brut = x as { boissonId?: unknown; intensite?: unknown };
    const boissonId = champ(brut?.boissonId).slice(0, 40);
    const intensite = Number(brut?.intensite);
    if (!boissonId || vus.has(boissonId) || !Number.isFinite(intensite)) continue;
    const cran = Math.min(INTENSITE_MAX, Math.max(0, Math.round(intensite)));
    if (cran === 0) continue;
    vus.add(boissonId);
    retenus.push({ boissonId, intensite: cran });
  }
  return retenus;
}

/** Le rythme declare, famille par famille : biere, vin, spiritueux. */
function niveaux(valeur: unknown): Record<string, string> {
  const brut = (valeur ?? {}) as Record<string, unknown>;
  const sortie: Record<string, string> = {};
  for (const famille of FAMILLES) {
    const niveau = champ(brut[famille]);
    sortie[famille] = NIVEAUX.has(niveau) ? niveau : 'aucun';
  }
  return sortie;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query['code'] ?? '');
  const evenement = await chargerEvenement(code);
  if (!evenement) return res.status(404).json({ erreur: 'Evenement introuvable' });

  // GET : juste de quoi afficher la page publique, rien de sensible. Les
  // co-organisateurs en font partie : l'invite doit pouvoir designer celui qui
  // l'invite, et un prenom n'est pas un secret.
  if (req.method === 'GET') {
    const partage = evenement.partage as {
      nom?: unknown;
      jours?: unknown;
      infos?: { lieu?: unknown; debut?: unknown; fin?: unknown; description?: unknown };
    } | null;
    const texte = (valeur: unknown) => (typeof valeur === 'string' ? valeur.slice(0, 500) : '');
    const participants = await chargerParticipants(code);
    return res.status(200).json({
      nom: typeof partage?.nom === 'string' ? partage.nom : 'Un evenement',
      jours: typeof partage?.jours === 'number' ? partage.jours : 1,
      lieu: texte(partage?.infos?.lieu),
      debut: texte(partage?.infos?.debut),
      fin: texte(partage?.infos?.fin),
      description: texte(partage?.infos?.description),
      organisateurs: participants.map((x) => ({ id: x.id, nom: texte(x.nom) })),
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

  const regime = champ(corps['regime']);
  const logistiqueBrute = (corps['logistique'] ?? {}) as Record<string, unknown>;
  const placesVoiture = Number(logistiqueBrute['placesVoiture']);
  const team = champ(corps['team']);

  // Le co-organisateur designe doit exister : sinon la fiche arriverait
  // rattachee a un identifiant que personne ne reconnait.
  const participants = await chargerParticipants(code);
  const invitPar = participants.find((x) => x.id === champ(corps['invitParId']));

  const reponse = {
    id: randomBytes(12).toString('hex'),
    prenom,
    nom: champ(corps['nom']),
    invitParId: invitPar?.id ?? '',
    invitePar: invitPar ? champ(invitPar.nom) : champ(corps['invitePar']),
    regime: REGIMES.has(regime) ? regime : 'omnivore',
    allergies: champ(corps['allergies']),
    commentaire: champ(corps['commentaire']),
    stylesMusicaux: champ(corps['stylesMusicaux']),
    surnom: champ(corps['surnom']),
    boissonsAimees: gouts(corps['boissonsAimees']),
    niveaux: niveaux(corps['niveaux']),
    autreAlcool: champ(corps['autreAlcool']),
    team: TEAMS.has(team) ? team : '',
    servicesPreferes: identifiants(corps['servicesPreferes'], 20),
    goodies: identifiants(corps['goodies'], 40),
    goodiesAutre: champ(corps['goodiesAutre']),
    logistique: {
      permis: logistiqueBrute['permis'] === true,
      vehicule: logistiqueBrute['vehicule'] === true,
      tente: logistiqueBrute['tente'] === true,
      sejourComplet: logistiqueBrute['sejourComplet'] !== false,
      placesVoiture: Number.isFinite(placesVoiture)
        ? Math.min(9, Math.max(0, Math.round(placesVoiture)))
        : 0,
      chercheCovoiturage: logistiqueBrute['chercheCovoiturage'] === true,
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
