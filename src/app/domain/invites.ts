import { Effectif, Invite, Regime } from './models';

/**
 * Invites nommes.
 *
 * L'app a deux facons de declarer des invites : les effectifs anonymes
 * (« j'amene trois buveurs de biere ») et les invites nommes (« Paul, buveur
 * de biere »). Les deux s'additionnent : nommer quelqu'un AJOUTE une tete,
 * ca ne remplace pas un effectif deja saisi.
 */

export const REGIMES: readonly { id: Regime; libelle: string }[] = [
  { id: 'omnivore', libelle: 'Omnivore' },
  { id: 'vegetarien', libelle: 'Vegetarien' },
  { id: 'vegan', libelle: 'Vegan' },
  { id: 'sans-gluten', libelle: 'Sans gluten' },
  { id: 'sans-lactose', libelle: 'Sans lactose' },
  { id: 'halal', libelle: 'Halal' },
  { id: 'casher', libelle: 'Casher' },
];

export const LIBELLE_REGIME: Record<Regime, string> = Object.fromEntries(
  REGIMES.map((x) => [x.id, x.libelle]),
) as Record<Regime, string>;

export function inviteVierge(id: string, participantId: string): Invite {
  return {
    id,
    prenom: '',
    nom: '',
    participantId,
    personneTypeId: '',
    regime: 'omnivore',
    allergies: '',
    envies: '',
    remarques: '',
  };
}

/** Les invites nommes qu'un co-organisateur amene. */
export function invitesNommesDe(invites: readonly Invite[], participantId: string): Invite[] {
  return invites.filter((x) => x.participantId === participantId);
}

/**
 * Fusionne les effectifs anonymes et les invites nommes d'un participant :
 * chaque invite nomme dont le profil existe encore compte pour une personne
 * de ce profil. C'est cette fusion qui alimente le moteur de calcul, pour
 * que l'invariant « on raisonne en personnes x profils » tienne toujours.
 */
export function fusionnerEffectifs(
  effectifs: readonly Effectif[],
  invitesNommes: readonly Invite[],
): Effectif[] {
  const total = new Map<string, number>();
  for (const effectif of effectifs) {
    if (effectif.nombre > 0) {
      total.set(
        effectif.personneTypeId,
        (total.get(effectif.personneTypeId) ?? 0) + effectif.nombre,
      );
    }
  }
  for (const invite of invitesNommes) {
    if (invite.personneTypeId) {
      total.set(invite.personneTypeId, (total.get(invite.personneTypeId) ?? 0) + 1);
    }
  }
  return [...total.entries()].map(([personneTypeId, nombre]) => ({ personneTypeId, nombre }));
}

/**
 * Un invite nomme SANS profil compte quand meme comme une tete a nourrir :
 * on le represente par un effectif vers un profil vide, que le moteur ignore
 * cote boissons mais que invitesDe() additionne.
 */
export function effectifsAvecInvites(
  effectifs: readonly Effectif[],
  invitesNommes: readonly Invite[],
): Effectif[] {
  const fusion = fusionnerEffectifs(effectifs, invitesNommes);
  const sansProfil = invitesNommes.filter((x) => !x.personneTypeId).length;
  return sansProfil > 0 ? [...fusion, { personneTypeId: '', nombre: sansProfil }] : fusion;
}

export interface CompteRegime {
  regime: Regime;
  libelle: string;
  nombre: number;
}

/** Combien de personnes par regime, pour dimensionner les plats. */
export function compterParRegime(invites: readonly Invite[]): CompteRegime[] {
  const total = new Map<Regime, number>();
  for (const invite of invites) {
    total.set(invite.regime, (total.get(invite.regime) ?? 0) + 1);
  }
  return REGIMES.filter((x) => total.has(x.id)).map((x) => ({
    regime: x.id,
    libelle: x.libelle,
    nombre: total.get(x.id) ?? 0,
  }));
}

/** Les invites qui declarent une allergie : la liste a avoir en cuisine. */
export function invitesAvecAllergies(invites: readonly Invite[]): Invite[] {
  return invites.filter((x) => x.allergies.trim().length > 0);
}
