import { MomentRepas, TypePlat, UniteIngredient } from './models';

/**
 * Les menus du Festivial, tels qu'ils ont ete arretes a la main.
 *
 * Ce ne sont pas des idees de plats parmi d'autres : c'est LE menu de
 * l'evenement, prêt a etre pose sur le calendrier en un clic. Les doses
 * restent par personne — le nombre de convives et l'arrondi au kilo se font
 * plus tard, comme partout ailleurs dans l'app.
 *
 * Les prix sont dans l'unite d'achat : au kilo, au litre, ou a la piece. Ils
 * ont ete deduits des tarifs releves en magasin (un paquet de 250 g de cafe a
 * 3,50 € donne 14 €/kg) : c'est le magasin qui affiche un prix au kilo, pas un
 * prix au paquet.
 *
 * Le petit-dejeuner est servi DEUX matins. Les quantites d'origine etaient
 * cumulees sur les deux ; ici chaque matin porte sa moitie, pour que le
 * calendrier dise la verite et que l'agregat retombe sur le meme total.
 */

export interface IngredientMenu {
  nom: string;
  qteParPersonne: number;
  unite: UniteIngredient;
  prixUnitaire: number;
}

export interface MenuFestivial {
  jour: number;
  moment: MomentRepas;
  plat: string;
  typePlat: TypePlat;
  vegetarienPrevu: boolean;
  notes: string;
  ingredients: IngredientMenu[];
}

function ing(
  nom: string,
  qteParPersonne: number,
  unite: UniteIngredient,
  prixUnitaire: number,
): IngredientMenu {
  return { nom, qteParPersonne, unite, prixUnitaire };
}

/** Un matin de petit-dejeuner : la moitie du cumul annonce sur deux matins. */
function petitDejeuner(jour: number): MenuFestivial {
  return {
    jour,
    moment: 'petit-dejeuner',
    plat: 'Viennoiseries, jus & cafe',
    typePlat: 'petit-dejeuner',
    vegetarienPrevu: true,
    notes: 'Servi les deux matins : les doses ci-dessous sont pour UN matin.',
    ingredients: [
      ing('Croissant', 1, 'piece', 0.4),
      ing('Pain au chocolat', 1, 'piece', 0.45),
      ing("Jus d'orange", 150, 'ml', 1.8),
      ing('Jus de pomme', 100, 'ml', 1.6),
      ing('Lait', 50, 'ml', 1.1),
      ing('Cafe moulu', 8, 'g', 14),
      ing('The (sachets)', 0.5, 'piece', 0.08),
    ],
  };
}

export const MENUS_FESTIVIAL: readonly MenuFestivial[] = [
  {
    jour: 1,
    moment: 'dejeuner',
    plat: 'Barbecue & semoule',
    typePlat: 'barbecue',
    vegetarienPrevu: false,
    notes: '',
    ingredients: [
      ing('Semoule (couscous)', 70, 'g', 1.8),
      ing('Boulettes de viande', 3, 'piece', 0.3),
      ing('Concombre', 0.5, 'piece', 1),
      ing('Sauce blanche (yaourt grec)', 40, 'g', 3.5),
    ],
  },
  {
    jour: 1,
    moment: 'diner',
    plat: 'Pizzas maison',
    typePlat: 'pizza',
    vegetarienPrevu: true,
    notes: 'Roquette a ajouter apres cuisson.',
    ingredients: [
      ing('Pate a pain (patons)', 0.8, 'piece', 0.8),
      ing('Sauce tomate', 73, 'ml', 2),
      ing('Mozzarella rapee', 93, 'g', 9),
      ing('Jambon blanc', 23, 'g', 12),
      ing('Chorizo', 17, 'g', 14),
      ing('Champignons', 23, 'g', 3.5),
      ing('Roquette', 12.5, 'g', 12),
    ],
  },
  petitDejeuner(2),
  {
    jour: 2,
    moment: 'dejeuner',
    plat: 'Sandwichs',
    typePlat: 'autre',
    vegetarienPrevu: true,
    notes: '',
    ingredients: [
      ing('Baguette de pain', 0.5, 'piece', 0.9),
      ing('Jambon blanc', 60, 'g', 12),
      ing('Emmental en tranches', 40, 'g', 10),
      ing('Beurre / mayonnaise', 15, 'g', 8.8),
      ing('Chips', 30, 'g', 9),
    ],
  },
  {
    jour: 2,
    moment: 'diner',
    plat: 'Paella',
    typePlat: 'plat-mijote',
    vegetarienPrevu: false,
    notes: '',
    ingredients: [
      ing('Riz a paella', 80, 'g', 2.2),
      ing('Poulet (hauts de cuisses)', 120, 'g', 8.5),
      ing('Chorizo a cuire', 30, 'g', 14),
      ing('Crevettes', 50, 'g', 14),
      ing('Moules', 60, 'g', 5),
      ing('Melange poivrons / pois', 80, 'g', 2.5),
      ing('Epices / bouillon paella', 0.2, 'piece', 4),
    ],
  },
  petitDejeuner(3),
  {
    jour: 3,
    moment: 'dejeuner',
    plat: 'Legumes grilles & saucisses',
    typePlat: 'barbecue',
    vegetarienPrevu: true,
    notes: 'Les legumes grilles font le plat vegetarien.',
    ingredients: [
      ing('Courgette', 80, 'g', 2.5),
      ing('Poivron', 80, 'g', 3),
      ing('Aubergine', 80, 'g', 2.8),
      ing('Merguez', 1, 'piece', 0.65),
      ing('Saucisse aux herbes', 1, 'piece', 0.65),
      ing('Saucisse nature', 1, 'piece', 0.65),
    ],
  },
];

/** Le nombre de jours que le menu couvre : de quoi caler la duree si besoin. */
export const JOURS_MENUS_FESTIVIAL = MENUS_FESTIVIAL.reduce((max, x) => Math.max(max, x.jour), 1);
