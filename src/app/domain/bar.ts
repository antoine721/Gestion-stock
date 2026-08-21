import { appliquerOverride, reglagesCalculParDefaut } from './calcul';
import { BOISSONS, BOISSON_PAR_ID, PRODUITS_DILUANTS, PRODUIT_PAR_ID } from './catalogue';
import { Boisson, LigneAchat, Override, Produit, ReglagesCalcul, VerresBoisson } from './models';

/**
 * Les diluants : ce avec quoi on coupe les alcools forts.
 *
 * Le moteur ne les achete pas tout seul — le format et la marque se decident
 * devant le rayon — mais il sait qu'un rhum se boit au coca et un gin au
 * tonic. Chaque alcool porte donc ses diluants, modifiables : c'est ce qui
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

/**
 * Ce que l'organisateur a tranche, tel qu'il est stocke. Les fiches d'avant ne
 * portaient qu'un diluant par alcool : une chaine seule se lit toujours.
 */
export type ChoixDiluants = ReadonlyMap<string, string | readonly string[]>;

/** Un diluant retenu et la part du besoin qui lui revient. */
export interface DiluantRetenu {
  produit: Produit;
  besoinMl: number;
}

export interface AlcoolADiluer {
  boissonId: string;
  nom: string;
  /** Verres sur toute la duree de l'evenement, tout le monde confondu. */
  verres: number;
  /** Les diluants retenus : ceux choisis par l'organisateur, sinon le defaut. */
  diluants: DiluantRetenu[];
  /** L'organisateur a tranche lui-meme. */
  choisi: boolean;
  /** Cet alcool se boit sec : il n'y a rien a prevoir. */
  sec: boolean;
  /** Ce qu'il faut de diluant en tout, marge comprise. */
  besoinMl: number;
}

/**
 * Les diluants d'un alcool : le choix de l'organisateur, sinon le defaut. Une
 * liste vide dit « celui-la, on le boit sec ».
 */
export function diluantsDe(boissonId: string, choix: ChoixDiluants): string[] {
  const choisi = choix.get(boissonId);
  if (choisi === undefined) {
    const defaut = DILUANT_PAR_DEFAUT[boissonId];
    return defaut ? [defaut] : [];
  }
  const liste = typeof choisi === 'string' ? [choisi] : choisi;
  return [...new Set(liste)].filter((x) => x !== '' && PRODUIT_PAR_ID.has(x));
}

/**
 * Ce qu'il faut couper, alcool par alcool. Un alcool sans verre declare ne
 * figure pas : on ne prevoit pas de coca pour un rhum que personne ne boit.
 */
export function alcoolsADiluer(
  consommation: readonly VerresBoisson[],
  choix: ChoixDiluants,
  reglages: ReglagesCalcul = reglagesCalculParDefaut(),
  overrides: ReadonlyMap<string, Override> = new Map(),
): AlcoolADiluer[] {
  const coup = 1 + Math.max(0, reglages.coefficientPct) / 100;
  const marge = 1 + Math.max(0, reglages.margeDiluantPct) / 100;
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
      const produits = (sec ? [] : diluantsDe(boissonId, choix))
        .map((id) => PRODUIT_PAR_ID.get(id))
        .filter((x): x is Produit => x !== undefined);
      const parVerre = ML_DILUANT[boissonId] ?? ML_DILUANT_STANDARD;
      const besoinMl = produits.length > 0 ? verres * parVerre * coup * marge : 0;

      // Deux diluants sur un meme alcool, c'est un verre au coca et le suivant
      // au jus : le volume total ne double pas, il se partage. On ne sait pas
      // qui prendra quoi, alors on coupe en parts egales.
      const part = produits.length > 0 ? besoinMl / produits.length : 0;

      return {
        boissonId,
        nom: BOISSON_PAR_ID.get(boissonId)?.nom ?? boissonId,
        verres,
        diluants: produits.map((produit) => ({
          produit: appliquerOverride(produit, overrides),
          besoinMl: part,
        })),
        choisi: choix.has(boissonId),
        sec,
        besoinMl,
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
    for (const diluant of alcool.diluants) {
      if (diluant.besoinMl <= 0) continue;
      const deja = parProduit.get(diluant.produit.id);
      if (deja) {
        deja.besoinMl += diluant.besoinMl;
        deja.alcools.push(alcool.nom);
      } else {
        parProduit.set(diluant.produit.id, {
          produit: diluant.produit,
          besoinMl: diluant.besoinMl,
          alcools: [alcool.nom],
        });
      }
    }
  }
  return [...parProduit.values()].sort((a, b) => b.besoinMl - a.besoinMl);
}

/** Ce qu'on peut choisir comme diluant : les softs du catalogue. */
export const DILUANTS_POSSIBLES = PRODUITS_DILUANTS;

// ---------------------------------------------------------------------------
// Les recettes composees : kir, spritz — plusieurs bouteilles pour un verre
// ---------------------------------------------------------------------------

/**
 * Les boissons alcoolisees qui reclament plusieurs produits. Elles ne
 * s'achetent nulle part comme telles : un spritz, c'est du prosecco, de
 * l'Aperol et de l'eau petillante, pris chacun de leur cote mais bus
 * ensemble. Rien ne les distingue dans le caddie — d'ou le regroupement.
 */
export const COCKTAILS_COMPOSES: readonly Boisson[] = BOISSONS.filter(
  (boisson) =>
    boisson.composants.length > 1 &&
    boisson.composants.some((c) => (PRODUIT_PAR_ID.get(c.produitId)?.degre ?? 0) > 0),
);

/**
 * Un ingredient de la recette dont la bouteille est comptee ailleurs : le vin
 * blanc qu'on boit surtout au verre, l'eau petillante qui part avec les
 * diluants. On le rappelle sans le chiffrer deux fois.
 */
export interface RappelCocktail {
  nom: string;
  /** Ce que le cocktail en consomme, brut. */
  ml: number;
  /** Ou la bouteille est comptee : sur sa propre ligne, ou avec les diluants. */
  ou: 'liste' | 'diluants';
}

export interface GroupeCocktail {
  boissonId: string;
  nom: string;
  verres: number;
  /** Les lignes d'achat qui appartiennent au cocktail. */
  lignes: LigneAchat[];
  rappels: RappelCocktail[];
}

/**
 * Range les lignes d'achat par cocktail compose, pour les montrer ensemble.
 *
 * Une ligne rejoint le groupe quand le cocktail est son usage principal.
 * Sinon elle reste dans la liste generale — le vin blanc dont on boit dix
 * verres pour deux kirs s'achete pour le vin blanc, pas pour le kir — et le
 * groupe n'en garde qu'un rappel. Une bouteille n'apparait jamais deux fois :
 * le regroupement est un confort de lecture, pas un second calcul.
 */
export function regrouperCocktails(
  lignes: readonly LigneAchat[],
  consommation: readonly VerresBoisson[],
): { groupes: GroupeCocktail[]; autres: LigneAchat[] } {
  const verresPar = new Map<string, number>();
  for (const ligne of consommation) {
    verresPar.set(
      ligne.boissonId,
      (verresPar.get(ligne.boissonId) ?? 0) + Math.max(0, ligne.verres),
    );
  }

  const pris = new Set<string>();
  const groupes: GroupeCocktail[] = [];

  for (const cocktail of COCKTAILS_COMPOSES) {
    const verres = verresPar.get(cocktail.id) ?? 0;
    if (verres <= 0) continue;

    const lignesGroupe: LigneAchat[] = [];
    const rappels: RappelCocktail[] = [];

    for (const composant of cocktail.composants) {
      const ligne = lignes.find((x) => x.produit.id === composant.produitId);
      const produit = ligne?.produit ?? PRODUIT_PAR_ID.get(composant.produitId);
      const mlCocktail =
        ligne?.detail.find((x) => x.boissonNom === cocktail.nom)?.ml ?? verres * composant.ml;

      const total = ligne?.detail.reduce((somme, x) => somme + x.ml, 0) ?? 0;
      const usagePrincipal = mlCocktail * 2 > total;

      if (ligne && usagePrincipal && !pris.has(ligne.produit.id)) {
        pris.add(ligne.produit.id);
        lignesGroupe.push(ligne);
      } else {
        rappels.push({
          nom: produit?.nom ?? composant.produitId,
          ml: mlCocktail,
          // Les diluants ne partent pas dans les courses : ils ont leur
          // propre tableau, plus haut.
          ou: ligne ? 'liste' : 'diluants',
        });
      }
    }

    if (lignesGroupe.length > 0) {
      groupes.push({
        boissonId: cocktail.id,
        nom: cocktail.nom,
        verres,
        lignes: lignesGroupe,
        rappels,
      });
    }
  }

  return { groupes, autres: lignes.filter((x) => !pris.has(x.produit.id)) };
}
