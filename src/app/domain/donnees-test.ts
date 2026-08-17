import { BOISSONS } from './catalogue';
import { HEBERGEMENTS, inviteVierge } from './invites';
import { CategoriePaiement, Invite, Participant, PersonneType, Regime } from './models';

/**
 * Jeu d'essai : peupler l'evenement d'invites credibles pour tester l'app en
 * volume reel — filtres, paiements, profils de buveurs, logistique, missions.
 *
 * Le generateur est deterministe (congruence lineaire semee) : pas de
 * Math.random, les memes entrees produisent les memes fiches, donc c'est
 * testable. Tous les ids portent le prefixe de test : c'est le marqueur qui
 * permet de les retirer d'un coup sans toucher aux vrais invites.
 */

export const PREFIXE_INVITE_TEST = 'test-';

export function estInviteTest(invite: Invite): boolean {
  return invite.id.startsWith(PREFIXE_INVITE_TEST);
}

const PRENOMS = [
  'Alice',
  'Bastien',
  'Camille',
  'David',
  'Emma',
  'Felix',
  'Garance',
  'Hugo',
  'Ines',
  'Jules',
  'Klara',
  'Leo',
  'Manon',
  'Nino',
  'Oceane',
  'Paul',
  'Quitterie',
  'Romain',
  'Sarah',
  'Theo',
  'Ulysse',
  'Victoire',
  'William',
  'Yasmine',
  'Zoe',
  'Antonin',
  'Berenice',
  'Clement',
  'Diane',
  'Elias',
];

const NOMS = [
  'Martin',
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Lefebvre',
  'Michel',
  'Garcia',
  'Roux',
  'Fournier',
  'Morel',
  'Girard',
  'Andre',
];

const REGIMES_TIRAGE: readonly { regime: Regime; poids: number }[] = [
  { regime: 'omnivore', poids: 62 },
  { regime: 'vegetarien', poids: 14 },
  { regime: 'vegan', poids: 8 },
  { regime: 'sans-gluten', poids: 6 },
  { regime: 'sans-lactose', poids: 4 },
  { regime: 'halal', poids: 4 },
  { regime: 'casher', poids: 2 },
];

const ALLERGIES = ['arachides', 'fruits a coque', 'lactose', 'gluten', 'crustaces', 'oeufs'];
const ENVIES = [
  'DJ, mixer un set',
  'petanque',
  'karaoke',
  'jeux de societe',
  'beer pong',
  'tenir le bar',
  'faire le feu de camp',
  'blind test',
];
const STYLES = ['techno', 'house', 'rock', 'annees 80', 'rap', 'disco funk', 'reggae', 'pop'];
const MATERIEL_PRETE = ['enceinte', 'guirlandes led', 'barnum', 'glaciere', 'plancha', 'tireuse'];
const BESOINS = ['un matelas', 'une place en voiture', 'un adaptateur', 'de la place au frigo'];
const REMARQUES = [
  'arrive en retard le premier soir',
  'repart tot dimanche',
  'ne connait personne, a presenter',
  'vient avec son chien',
];
const ARRIVEES = ['vendredi 18h', 'vendredi 21h', 'samedi 10h', 'samedi 14h'];
const DEPARTS = ['dimanche 11h', 'dimanche 17h', 'lundi matin'];

/** Congruence lineaire classique : rapide, seme, et largement suffisant ici. */
function fabriquerAlea(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    return etat / 4294967296;
  };
}

function parmi<T>(alea: () => number, liste: readonly T[]): T {
  return liste[Math.floor(alea() * liste.length)];
}

function tirerRegime(alea: () => number): Regime {
  const total = REGIMES_TIRAGE.reduce((somme, x) => somme + x.poids, 0);
  let tirage = alea() * total;
  for (const { regime, poids } of REGIMES_TIRAGE) {
    tirage -= poids;
    if (tirage <= 0) return regime;
  }
  return 'omnivore';
}

/**
 * Genere `parParticipant` invites pour chaque co-organisateur. Chaque fiche
 * est complete : profil de buveur (piochee dans les profils existants),
 * regime, paiement, presence, conso declaree et logistique.
 */
export function genererInvitesTest(
  participants: readonly Participant[],
  personnesTypes: readonly PersonneType[],
  categories: readonly CategoriePaiement[],
  jours: number,
  parParticipant = 50,
): Invite[] {
  const alea = fabriquerAlea(20260817);
  const invites: Invite[] = [];

  participants.forEach((participant, index) => {
    for (let i = 0; i < parParticipant; i += 1) {
      const invite = inviteVierge(`${PREFIXE_INVITE_TEST}${index}-${i}`, participant.id);
      invite.prenom = parmi(alea, PRENOMS);
      invite.nom = parmi(alea, NOMS);
      invite.regime = tirerRegime(alea);

      // ~9 fiches sur 10 ont leur categorie de buveur ; le reste attend son
      // profil, comme dans la vraie vie — et ca alimente la todo des stats.
      if (personnesTypes.length > 0 && alea() < 0.9) {
        invite.personneTypeId = parmi(alea, personnesTypes).id;
      }

      if (alea() < 0.15) invite.allergies = parmi(alea, ALLERGIES);
      if (alea() < 0.3) invite.envies = parmi(alea, ENVIES);
      if (alea() < 0.45) invite.stylesMusicaux = parmi(alea, STYLES);
      if (alea() < 0.15) invite.remarques = parmi(alea, REMARQUES);

      if (categories.length > 0 && alea() < 0.85) {
        const categorie = parmi(alea, categories);
        invite.categoriePaiementId = categorie.id;
        if (alea() < 0.6) {
          invite.paye = true;
          // Quelques reglements partiels, pour tester la colonne « reste ».
          invite.montantPaye = alea() < 0.2 ? Math.round(categorie.montant / 2) : categorie.montant;
        }
      }
      invite.joursPresence = 1 + Math.floor(alea() * Math.max(1, jours));

      const nbBoissons = Math.floor(alea() * 4);
      const declarees = new Set<string>();
      for (let b = 0; b < nbBoissons; b += 1) {
        const boisson = parmi(alea, BOISSONS);
        if (declarees.has(boisson.id)) continue;
        declarees.add(boisson.id);
        invite.consommationDeclaree = [
          ...invite.consommationDeclaree,
          { boissonId: boisson.id, verresParJour: 1 + Math.floor(alea() * 5) },
        ];
      }

      const logistique = { ...invite.logistique };
      logistique.permis = alea() < 0.65;
      logistique.vehicule = logistique.permis && alea() < 0.55;
      logistique.placesVoiture = logistique.vehicule ? 1 + Math.floor(alea() * 4) : 0;
      logistique.chercheCovoiturage = !logistique.vehicule && alea() < 0.3;
      logistique.hebergement = parmi(alea, HEBERGEMENTS).id;
      logistique.arrivee = parmi(alea, ARRIVEES);
      logistique.depart = parmi(alea, DEPARTS);
      if (alea() < 0.25) logistique.materielApporte = parmi(alea, MATERIEL_PRETE);
      if (alea() < 0.15) logistique.besoins = parmi(alea, BESOINS);
      invite.logistique = logistique;

      invites.push(invite);
    }
  });

  return invites;
}
