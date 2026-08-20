import { MARGE_DILUANT } from './calcul';
import { BOISSON_PAR_ID, PRODUITS_DILUANTS, PRODUIT_PAR_ID } from './catalogue';
import { Produit, VerresBoisson } from './models';

/**
 * Les diluants : ce avec quoi on coupe les alcools forts.
 *
 * Le moteur ne les achete pas tout seul — le format et la marque se decident
 * devant le rayon — mais il sait qu'un rhum se boit au coca et un gin au
 * tonic. Chaque alcool porte donc son diluant, modifiable : c'est ce qui
 * permet de voir d'un coup d'oeil lesquels n'en ont pas encore.
 *
 * Tous n'en prennent pas. La tequila et le Jagermeister se boivent secs, le
 * vin ne se coupe pas, et le spritz porte son eau petillante dans sa recette :
 * elle n'est pas un choix, elle EST le spritz.
 */

/** Ce avec quoi chaque alcool fort se coupe, faute de choix contraire. */
export const DILUANT_PAR_DEFAUT: Record<string, string> = {
  rhum: 'coca',
  captain: 'coca',
  whisky: 'coca',
  vodka: 'jus-orange',
  gin: 'tonic',
  pastis: 'eau-plate',
  get: 'limonade',
  malibu: 'jus-ananas',
};

/** Ceux qui se boivent secs : un shot ne se coupe pas. */
export const SANS_DILUANT = new Set(['tequila', 'jager']);

/** Le pastis se noie dans cinq volumes d'eau ; les autres prennent 15 cl. */
const ML_DILUANT: Record<string, number> = { pastis: 125 };
const ML_DILUANT_STANDARD = 150;

/** Les alcools qui posent la question du diluant, dans l'ordre du catalogue. */
export const ALCOOLS_A_DILUER: readonly string[] = [
  ...Object.keys(DILUANT_PAR_DEFAUT),
  ...SANS_DILUANT,
];

export interface AlcoolADiluer {
  boissonId: string;
  nom: string;
  /** Verres sur toute la duree de l'evenement, tout le monde confondu. */
  verres: number;
  /** Le diluant retenu : celui choisi par l'organisateur, sinon celui par defaut. */
  produit: Produit | undefined;
  /** L'organisateur a tranche lui-meme. */
  choisi: boolean;
  /** Cet alcool se boit sec : il n'y a rien a prevoir. */
  sec: boolean;
  /** Ce qu'il faut de diluant, marge comprise. */
  besoinMl: number;
}

/** Le diluant d'un alcool : le choix de l'organisateur, sinon le defaut. */
export function diluantDe(
  boissonId: string,
  choix: ReadonlyMap<string, string>,
): string | undefined {
  const choisi = choix.get(boissonId);
  if (choisi !== undefined) return choisi === '' ? undefined : choisi;
  return DILUANT_PAR_DEFAUT[boissonId];
}

/**
 * Ce qu'il faut couper, alcool par alcool. Un alcool sans verre declare ne
 * figure pas : on ne prevoit pas de coca pour un rhum que personne ne boit.
 */
export function alcoolsADiluer(
  consommation: readonly VerresBoisson[],
  choix: ReadonlyMap<string, string>,
): AlcoolADiluer[] {
  const verresPar = new Map<string, number>();
  for (const ligne of consommation) {
    verresPar.set(
      ligne.boissonId,
      (verresPar.get(ligne.boissonId) ?? 0) + Math.max(0, ligne.verres),
    );
  }

  return ALCOOLS_A_DILUER.filter((id) => (verresPar.get(id) ?? 0) > 0)
    .map((boissonId) => {
      const verres = verresPar.get(boissonId) ?? 0;
      const sec = SANS_DILUANT.has(boissonId);
      const produitId = sec ? undefined : diluantDe(boissonId, choix);
      const parVerre = ML_DILUANT[boissonId] ?? ML_DILUANT_STANDARD;
      return {
        boissonId,
        nom: BOISSON_PAR_ID.get(boissonId)?.nom ?? boissonId,
        verres,
        produit: produitId ? PRODUIT_PAR_ID.get(produitId) : undefined,
        choisi: choix.has(boissonId),
        sec,
        besoinMl: produitId ? verres * parVerre * (1 + MARGE_DILUANT) : 0,
      };
    })
    .sort((a, b) => b.verres - a.verres);
}

export interface BesoinParDiluant {
  produit: Produit;
  besoinMl: number;
  /** Les alcools qui le reclament, du plus gros buveur au plus petit. */
  alcools: string[];
}

/** Le meme besoin, vu depuis le caddie : une ligne par bouteille a acheter. */
export function regrouperParDiluant(alcools: readonly AlcoolADiluer[]): BesoinParDiluant[] {
  const parProduit = new Map<string, BesoinParDiluant>();
  for (const alcool of alcools) {
    if (!alcool.produit || alcool.besoinMl <= 0) continue;
    const deja = parProduit.get(alcool.produit.id);
    if (deja) {
      deja.besoinMl += alcool.besoinMl;
      deja.alcools.push(alcool.nom);
    } else {
      parProduit.set(alcool.produit.id, {
        produit: alcool.produit,
        besoinMl: alcool.besoinMl,
        alcools: [alcool.nom],
      });
    }
  }
  return [...parProduit.values()].sort((a, b) => b.besoinMl - a.besoinMl);
}

/** Ce qu'on peut choisir comme diluant : les softs du catalogue. */
export const DILUANTS_POSSIBLES = PRODUITS_DILUANTS;
