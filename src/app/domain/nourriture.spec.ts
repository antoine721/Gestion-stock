import { describe, expect, it } from 'vitest';
import {
  budgetNourriture,
  coursesCuisine,
  coutDesExtras,
  coutDuRepas,
  repasPour,
  repasVierge,
} from './nourriture';
import { IngredientRepas, Nourriture, Repas } from './models';

function ingredient(qteParPersonne: number): IngredientRepas {
  return { id: 'i1', nom: 'Riz', qteParPersonne, unite: 'g', prixUnitaire: 2 };
}

function repas(jour: number, options: Partial<Repas> = {}): Repas {
  return { ...repasVierge(`r${jour}`, jour, 'diner'), plat: 'Barbecue', ...options };
}

describe('nourriture', () => {
  it('coute par personne multiplie par les convives du repas', () => {
    expect(coutDuRepas(repas(1, { coutParPersonne: 7 }), 20)).toBe(140);
  });

  it('un nombre de convives explicite prime sur le total des invites', () => {
    // Petit dejeuner du depart : seuls les dormeurs sont encore la.
    expect(coutDuRepas(repas(1, { coutParPersonne: 2.5, convives: 8 }), 20)).toBe(20);
  });

  it('additionne les extras en quantite fixe', () => {
    expect(
      coutDesExtras([
        { id: 'x1', nom: 'Chips', quantite: 10, prixUnitaire: 1.5 },
        { id: 'x2', nom: 'Gateaux apero', quantite: 4, prixUnitaire: 2 },
      ]),
    ).toBe(23);
  });

  it('budget : repas decides + extras, et compte ce qui manque', () => {
    const nourriture: Nourriture = {
      repas: [
        repas(1, { coutParPersonne: 7 }),
        // Plat pas encore decide : ne coute rien, mais reste a planifier.
        repas(2, { plat: '' }),
      ],
      extras: [{ id: 'x', nom: 'Chips', quantite: 2, prixUnitaire: 2 }],
    };

    const budget = budgetNourriture(nourriture, 10, 2);
    expect(budget.coutRepas).toBe(70);
    expect(budget.coutExtras).toBe(4);
    expect(budget.total).toBe(74);
    expect(budget.repasPrevus).toBe(1);
    // 2 jours x 3 moments = 6 cases, une seule decidee.
    expect(budget.repasManquants).toBe(5);
  });

  it('un repas qu’on decide de ne pas faire n’est plus a decider', () => {
    const nourriture: Nourriture = {
      repas: [
        repas(1, { coutParPersonne: 7 }),
        // On a tranche : pas de repas sur cette case. Elle sort du compte.
        { ...repas(1, { id: 'saute', moment: 'dejeuner' }), plat: '', sansRepas: true },
      ],
      extras: [],
    };

    const budget = budgetNourriture(nourriture, 10, 1);
    // 3 cases dans la journee, une decidee, une sautee : il en reste une.
    expect(budget.repasManquants).toBe(1);
    expect(budget.repasSautes).toBe(1);
    expect(budget.repasPrevus).toBe(1);
  });

  it('ne compte ni le cout ni les ingredients d’un repas qu’on ne fait pas', () => {
    const nourriture: Nourriture = {
      repas: [
        {
          ...repas(1, { coutParPersonne: 7 }),
          sansRepas: true,
          ingredients: [
            { id: 'i', nom: 'Viande', qteParPersonne: 200, unite: 'g', prixUnitaire: 12 },
          ],
        },
      ],
      extras: [],
    };

    expect(budgetNourriture(nourriture, 10, 1).coutRepas).toBe(0);
  });

  it('ignore un repas planifie au-dela de la duree de l’evenement', () => {
    const nourriture: Nourriture = { repas: [repas(3, { coutParPersonne: 5 })], extras: [] };
    expect(budgetNourriture(nourriture, 10, 1).coutRepas).toBe(0);
  });

  it('retrouve le repas d’une case jour x moment', () => {
    const nourriture: Nourriture = { repas: [repas(2)], extras: [] };
    expect(repasPour(nourriture, 2, 'diner')?.plat).toBe('Barbecue');
    expect(repasPour(nourriture, 2, 'dejeuner')).toBeUndefined();
  });

  it("garde la part de chaque repas dans le besoin d'un ingredient", () => {
    // Le riz sert deux soirs : une seule ligne de courses, mais on sait
    // toujours quel jour en reclame combien.
    const nourriture: Nourriture = {
      repas: [
        repas(1, { plat: 'Riz cantonais', ingredients: [ingredient(80)] }),
        repas(2, { plat: 'Curry', ingredients: [ingredient(120)] }),
      ],
      extras: [],
    };

    const [ligne] = coursesCuisine(nourriture, 10, 2);
    expect(ligne.besoin).toBe(2000);
    expect(ligne.pourRepas).toEqual([
      { jour: 1, moment: 'diner', plat: 'Riz cantonais', quantite: 800 },
      { jour: 2, moment: 'diner', plat: 'Curry', quantite: 1200 },
    ]);
  });
});
