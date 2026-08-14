import { describe, expect, it } from 'vitest';
import { budgetGlobal, repartitionGlobale } from './stats';
import { articleVierge } from './materiel-liste';
import { PartCout } from './models';

function part(participantId: string, invites: number, montant: number): PartCout {
  return { participantId, nom: participantId, invites, verres: 0, part: 0, montant };
}

describe('budget global', () => {
  it('additionne les postes et calcule leurs parts', () => {
    const budget = budgetGlobal(150, 100, 50, 20);

    expect(budget.total).toBe(300);
    expect(budget.parPersonne).toBe(15);
    expect(budget.postes.find((x) => x.id === 'alcool')?.part).toBe(50);
    expect(budget.postes.find((x) => x.id === 'materiel')?.part).toBeCloseTo(100 / 6);
  });

  it('reste calme sur un evenement vide', () => {
    const budget = budgetGlobal(0, 0, 0, 0);
    expect(budget.total).toBe(0);
    expect(budget.parPersonne).toBe(0);
    expect(budget.postes.every((x) => x.part === 0)).toBe(true);
  });
});

describe('repartition globale', () => {
  it('alcool au volume, nourriture et materiel a la tete, avances deduites', () => {
    const articles = [{ ...articleVierge('generateur'), prixUnitaire: 60, payeParId: 'antoine' }];
    const parts = repartitionGlobale(
      [part('antoine', 5, 80), part('marie', 15, 20)],
      100,
      60,
      articles,
    );

    const antoine = parts.find((x) => x.participantId === 'antoine');
    const marie = parts.find((x) => x.participantId === 'marie');

    // 5 tetes sur 20 : un quart de la nourriture et du materiel.
    expect(antoine?.nourriture).toBe(25);
    expect(antoine?.materiel).toBe(15);
    expect(antoine?.du).toBe(120);
    expect(antoine?.avance).toBe(60);
    expect(antoine?.solde).toBe(60);

    expect(marie?.du).toBe(140);
    expect(marie?.solde).toBe(140);

    // Les parts couvrent tout le budget.
    expect((antoine?.part ?? 0) + (marie?.part ?? 0)).toBeCloseTo(100);
  });

  it('repartit a parts egales quand personne n’a declare d’invites', () => {
    const parts = repartitionGlobale([part('a', 0, 0), part('b', 0, 0)], 90, 0, []);
    expect(parts[0].nourriture).toBe(45);
    expect(parts[1].nourriture).toBe(45);
  });
});
