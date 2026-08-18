import { UniteAchat } from './models';

/**
 * Ce qu'on met dans le caddie : des pieces, ou un contenant d'un certain
 * poids.
 *
 * Deux facons d'acheter, et une seule ne suffit pas. « 4 paquets d'assiettes »
 * se compte a la piece. « 2 sacs de charbon » ne dit rien tant qu'on ne sait
 * pas s'ils font 4 kg ou 10 kg. On garde donc les deux : combien d'unites, et
 * ce que pese une unite.
 *
 * Les unites restent celles de l'etiquette — on n'invente pas de conversion :
 * un rayon n'est pas un moteur de calcul, c'est une liste qu'on lit devant un
 * lineaire.
 */

export const UNITES_ACHAT: readonly { id: UniteAchat; libelle: string; abrege: string }[] = [
  { id: 'piece', libelle: 'A la piece', abrege: '' },
  { id: 'g', libelle: 'Grammes', abrege: 'g' },
  { id: 'kg', libelle: 'Kilos', abrege: 'kg' },
  { id: 'ml', libelle: 'Millilitres', abrege: 'ml' },
  { id: 'L', libelle: 'Litres', abrege: 'L' },
];

export const ABREGE_UNITE: Record<UniteAchat, string> = Object.fromEntries(
  UNITES_ACHAT.map((x) => [x.id, x.abrege]),
) as Record<UniteAchat, string>;

/** « 1,5 » plutot que « 1.5 », et « 750 » plutot que « 750,0 ». */
function nombre(valeur: number): string {
  return Number.isInteger(valeur)
    ? String(valeur)
    : valeur
        .toFixed(2)
        .replace(/\.?0+$/, '')
        .replace('.', ',');
}

/** « 1,5 L », « 500 g ». Vide si l'article se compte a la piece. */
export function formatContenance(contenance: number, unite: UniteAchat): string {
  if (unite === 'piece' || contenance <= 0) return '';
  return `${nombre(contenance)} ${ABREGE_UNITE[unite]}`;
}

/**
 * Ce qu'on lit sur la ligne de courses : « × 4 » a la piece, « 4 × 1,5 L »
 * quand le contenant a un poids. C'est la ligne qu'on relit devant le rayon.
 */
export function libelleQuantite(quantite: number, contenance: number, unite: UniteAchat): string {
  const nb = Math.max(0, quantite);
  const taille = formatContenance(contenance, unite);
  return taille ? `${nombre(nb)} × ${taille}` : `× ${nombre(nb)}`;
}

/**
 * « 6 L » : ce que ca fait en tout, quand la question se pose.
 *
 * Le total remonte d'unite quand il depasse le millier : deux bidons de 500 ml
 * font un litre, pas « 1000 ml ». C'est le total qu'on compare a un besoin,
 * donc c'est lui qui doit se lire sans effort.
 */
export function totalContenance(quantite: number, contenance: number, unite: UniteAchat): string {
  if (unite === 'piece' || contenance <= 0 || quantite <= 1) return '';
  const total = Math.max(0, quantite) * contenance;
  if (unite === 'ml' && total >= 1000) return formatContenance(total / 1000, 'L');
  if (unite === 'g' && total >= 1000) return formatContenance(total / 1000, 'kg');
  return formatContenance(total, unite);
}

/** Les unites de l'etiquette, telles qu'Open Food Facts les ecrit. */
const LECTURES: readonly { motif: RegExp; unite: UniteAchat; facteur: number }[] = [
  { motif: /^kgs?$/, unite: 'kg', facteur: 1 },
  { motif: /^gr?s?$/, unite: 'g', facteur: 1 },
  { motif: /^mgs?$/, unite: 'g', facteur: 0.001 },
  { motif: /^l$/, unite: 'L', facteur: 1 },
  { motif: /^cls?$/, unite: 'ml', facteur: 10 },
  { motif: /^dls?$/, unite: 'ml', facteur: 100 },
  { motif: /^mls?$/, unite: 'ml', facteur: 1 },
];

export interface Conditionnement {
  contenance: number;
  unite: UniteAchat;
}

/**
 * Lit le conditionnement qu'Open Food Facts affiche en texte libre : « 1,5 L »,
 * « 500 g », « 6 x 33 cl », « 12 rouleaux ».
 *
 * Un pack (« 6 x 33 cl ») se lit comme SON contenant unitaire, pas comme le
 * total : c'est le pack qu'on met dans le caddie, et c'est la quantite de la
 * ligne qui dit combien de packs. Ce qui ne se lit pas revient a la piece —
 * jamais a zero, qui donnerait une ligne muette.
 */
export function lireConditionnement(texte: string): Conditionnement {
  const brut = texte.trim().toLowerCase().replace(',', '.');
  if (!brut) return { contenance: 0, unite: 'piece' };

  // On prend le DERNIER nombre suivi d'une unite : dans « 6 x 33 cl », c'est
  // « 33 cl » qui decrit le contenant.
  const trouves = [...brut.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)];
  for (const trouve of trouves.reverse()) {
    const valeur = Number(trouve[1]);
    const suffixe = trouve[2] ?? '';
    if (!Number.isFinite(valeur) || valeur <= 0) continue;
    const lecture = LECTURES.find((x) => x.motif.test(suffixe));
    if (!lecture) continue;

    const contenance = valeur * lecture.facteur;
    // Au-dela du millier, l'etiquette elle-meme change d'unite : 1500 g est
    // un 1,5 kg qui s'ignore.
    if (lecture.unite === 'g' && contenance >= 1000) {
      return { contenance: contenance / 1000, unite: 'kg' };
    }
    if (lecture.unite === 'ml' && contenance >= 1000) {
      return { contenance: contenance / 1000, unite: 'L' };
    }
    return { contenance: Math.round(contenance * 1000) / 1000, unite: lecture.unite };
  }

  return { contenance: 0, unite: 'piece' };
}
