import { Article, PartCout } from './models';
import { avancesDe } from './materiel-liste';

/**
 * Stats : le budget global et qui paye quoi.
 *
 * Chaque poste garde sa cle de repartition naturelle : l'alcool au volume
 * reellement bu par les invites de chacun, la nourriture et le materiel a la
 * tete. Les avances (articles payes par un participant) se deduisent a la fin
 * pour obtenir un solde, comme un compte entre amis.
 */

export type PosteId = 'alcool' | 'nourriture' | 'materiel';

export const LIBELLE_POSTE: Record<PosteId, string> = {
  alcool: 'Bar & boissons',
  nourriture: 'Nourriture',
  materiel: 'Materiel',
};

export interface PosteBudget {
  id: PosteId;
  libelle: string;
  montant: number;
  /** Part du budget global, en % (0 si le budget est vide). */
  part: number;
}

export interface BudgetGlobal {
  total: number;
  parPersonne: number;
  postes: PosteBudget[];
}

export function budgetGlobal(
  coutAlcool: number,
  coutNourriture: number,
  coutMateriel: number,
  invites: number,
): BudgetGlobal {
  const montants: [PosteId, number][] = [
    ['alcool', Math.max(0, coutAlcool)],
    ['nourriture', Math.max(0, coutNourriture)],
    ['materiel', Math.max(0, coutMateriel)],
  ];
  const total = montants.reduce((somme, [, montant]) => somme + montant, 0);
  return {
    total,
    parPersonne: invites > 0 ? total / invites : 0,
    postes: montants.map(([id, montant]) => ({
      id,
      libelle: LIBELLE_POSTE[id],
      montant,
      part: total > 0 ? (montant / total) * 100 : 0,
    })),
  };
}

export interface PartGlobale {
  participantId: string;
  nom: string;
  invites: number;
  /** Part d'alcool, au volume reellement bu par ses invites. */
  alcool: number;
  /** Nourriture repartie a la tete. */
  nourriture: number;
  /** Materiel reparti a la tete. */
  materiel: number;
  /** Ce que ce participant devrait payer au total. */
  du: number;
  /** Ce qu'il a deja avance : les articles payes par lui. */
  avance: number;
  /** Positif = il doit encore ca ; negatif = on lui doit. */
  solde: number;
  /** Part du budget global, en %. */
  part: number;
}

export function repartitionGlobale(
  partsAlcool: readonly PartCout[],
  coutNourriture: number,
  coutMateriel: number,
  articles: readonly Article[],
): PartGlobale[] {
  const totalInvites = partsAlcool.reduce((somme, x) => somme + x.invites, 0);
  const nombre = Math.max(1, partsAlcool.length);
  const partTetes = (part: PartCout) =>
    totalInvites > 0 ? part.invites / totalInvites : 1 / nombre;

  const parts = partsAlcool.map((part) => {
    const nourriture = coutNourriture * partTetes(part);
    const materiel = coutMateriel * partTetes(part);
    const du = part.montant + nourriture + materiel;
    const avance = avancesDe(articles, part.participantId);
    return {
      participantId: part.participantId,
      nom: part.nom,
      invites: part.invites,
      alcool: part.montant,
      nourriture,
      materiel,
      du,
      avance,
      solde: du - avance,
      part: 0,
    };
  });

  const total = parts.reduce((somme, x) => somme + x.du, 0);
  return parts.map((x) => ({ ...x, part: total > 0 ? (x.du / total) * 100 : 0 }));
}
