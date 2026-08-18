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
