import { describe, expect, it } from 'vitest';
import { JOURS_MENUS_FESTIVIAL, MENUS_FESTIVIAL } from './menus-festivial';
import { coursesCuisine } from './nourriture';
import { Nourriture } from './models';

/** Le menu pose sur le calendrier, prêt a passer dans le moteur de courses. */
function nourriture(): Nourriture {
  return {
    repas: MENUS_FESTIVIAL.map((menu, i) => ({
      id: `r${i}`,
      jour: menu.jour,
      moment: menu.moment,
      typePlat: menu.typePlat,
      plat: menu.plat,
      coutParPersonne: 0,
      convives: 0,
      vegetarienPrevu: menu.vegetarienPrevu,
      notes: menu.notes,
      ingredients: menu.ingredients.map((x, j) => ({ ...x, id: `i${i}-${j}` })),
    })),
    extras: [],
  };
}

/** Le groupe de reference sur lequel les quantites ont ete arretees. */
const CONVIVES = 15;

function ligne(nom: string) {
  return coursesCuisine(nourriture(), CONVIVES, JOURS_MENUS_FESTIVIAL).find((x) => x.nom === nom);
}

describe('menus du Festivial', () => {
  it('couvre trois jours, deux matins et cinq repas', () => {
    expect(JOURS_MENUS_FESTIVIAL).toBe(3);
    expect(MENUS_FESTIVIAL.filter((x) => x.moment === 'petit-dejeuner')).toHaveLength(2);
    expect(MENUS_FESTIVIAL).toHaveLength(7);
  });

  it('retombe sur les quantites de petit-dejeuner cumulees sur les deux matins', () => {
    // 1 croissant par matin x 2 matins x 15 personnes = 30.
    expect(ligne('Croissant')?.besoin).toBe(30);
    expect(ligne('Croissant')?.quantiteAchat).toBe(30);
    // 150 ml x 2 matins x 15 = 4,5 L, soit 5 briques d'un litre.
    expect(ligne("Jus d'orange")?.besoin).toBe(4500);
    expect(ligne("Jus d'orange")?.quantiteAchat).toBe(5);
    // 8 g x 2 x 15 = 240 g de cafe : un kilo suffit largement.
    expect(ligne('Cafe moulu')?.besoin).toBe(240);
    expect(ligne('Cafe moulu')?.quantiteAchat).toBe(1);
  });

  it('agrege le jambon des pizzas et des sandwichs en une seule ligne', () => {
    const jambon = ligne('Jambon blanc');
    // 23 g (pizzas) + 60 g (sandwichs) sur 15 personnes = 1245 g.
    expect(jambon?.besoin).toBe(1245);
    // Un seul arrondi pour les deux repas : 2 kg, pas 1 + 1.
    expect(jambon?.quantiteAchat).toBe(2);
    expect(jambon?.plats).toHaveLength(2);
  });

  it('compte les saucisses a la piece et le poulet au kilo', () => {
    expect(ligne('Merguez')?.quantiteAchat).toBe(15);
    expect(ligne('Merguez')?.uniteAchat).toBe('piece(s)');
    // 120 g x 15 = 1,8 kg de hauts de cuisses -> 2 kg.
    expect(ligne('Poulet (hauts de cuisses)')?.quantiteAchat).toBe(2);
    expect(ligne('Poulet (hauts de cuisses)')?.uniteAchat).toBe('kg');
  });

  it('donne un prix a chaque ingredient : aucune ligne gratuite par oubli', () => {
    const sansPrix = MENUS_FESTIVIAL.flatMap((menu) =>
      menu.ingredients.filter((x) => x.prixUnitaire <= 0).map((x) => `${menu.plat} / ${x.nom}`),
    );
    expect(sansPrix).toEqual([]);
  });
});
