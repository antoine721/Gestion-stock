import { describe, expect, it } from 'vitest';
import { articleVierge, avancesDe, budgetMateriel, coutArticle } from './materiel-liste';
import { Article } from './models';

function article(id: string, options: Partial<Article> = {}): Article {
  return { ...articleVierge(id), nom: id, ...options };
}

describe('materiel', () => {
  it('coute quantite x prix unitaire', () => {
    expect(coutArticle(article('tables', { quantite: 4, prixUnitaire: 12 }))).toBe(48);
  });

  it('ventile le budget par mode et par categorie, caution a part', () => {
    const budget = budgetMateriel([
      article('generateur', {
        categorie: 'electricite',
        mode: 'location',
        prixUnitaire: 80,
        caution: 200,
      }),
      article('guirlandes', {
        categorie: 'decoration',
        mode: 'achat',
        quantite: 3,
        prixUnitaire: 10,
      }),
      article('enceinte', { categorie: 'sono', mode: 'location', prixUnitaire: 50 }),
    ]);

    expect(budget.total).toBe(160);
    expect(budget.totalAchat).toBe(30);
    expect(budget.totalLocation).toBe(130);
    // La caution n'est PAS une depense : elle revient apres l'evenement.
    expect(budget.cautionTotale).toBe(200);
    expect(budget.parCategorie.find((x) => x.categorie === 'electricite')?.montant).toBe(80);
  });

  it('compte ce qui reste a prevoir', () => {
    const budget = budgetMateriel([
      article('a', { statut: 'a-prevoir' }),
      article('b', { statut: 'achete' }),
    ]);
    expect(budget.aPrevoir).toBe(1);
  });

  it('additionne les avances d’un participant', () => {
    const articles = [
      article('a', { payeParId: 'antoine', prixUnitaire: 30 }),
      article('b', { payeParId: 'marie', prixUnitaire: 10 }),
      article('c', { payeParId: 'antoine', quantite: 2, prixUnitaire: 5 }),
    ];
    expect(avancesDe(articles, 'antoine')).toBe(40);
  });
});
