import { describe, expect, it } from 'vitest';
import {
  CATEGORIES_COURSE,
  categorieDuProduit,
  libelleCategorieCourse,
  repartirParCategorie,
} from './categories-courses';

describe('rayons de la liste de courses', () => {
  it('range les boissons du bar entre alcool et sans alcool', () => {
    expect(categorieDuProduit('spiritueux')).toBe('alcool');
    expect(categorieDuProduit('biere')).toBe('alcool');
    expect(categorieDuProduit('vin')).toBe('alcool');
    expect(categorieDuProduit('soft')).toBe('soft');
    // Un sirop ne titre pas : il part avec les softs, pas avec l'alcool.
    expect(categorieDuProduit('sirop')).toBe('soft');
  });

  it('donne une couleur distincte a chaque rayon', () => {
    const teintes = CATEGORIES_COURSE.map((x) => x.teinte);
    expect(new Set(teintes).size).toBe(teintes.length);
    // L'alcool est en bleu : c'est la separation qu'on vient lire en premier.
    expect(CATEGORIES_COURSE.find((x) => x.id === 'alcool')?.teinte).toBe('bleu');
  });

  it('separe le total rayon par rayon', () => {
    const parts = repartirParCategorie([
      { categorie: 'alcool', prix: 60 },
      { categorie: 'alcool', prix: 40 },
      { categorie: 'nourriture', prix: 50 },
      { categorie: 'intendance', prix: 50 },
    ]);

    const alcool = parts.find((x) => x.categorie === 'alcool');
    expect(alcool?.montant).toBe(100);
    expect(alcool?.part).toBe(50);
    expect(alcool?.lignes).toBe(2);
    expect(parts.reduce((somme, x) => somme + x.part, 0)).toBeCloseTo(100);
  });

  it('ne sort pas les rayons vides : une part a zero n’apprend rien', () => {
    const parts = repartirParCategorie([{ categorie: 'alcool', prix: 20 }]);
    expect(parts.map((x) => x.categorie)).toEqual(['alcool']);
  });

  it('survit a une liste vide sans diviser par zero', () => {
    expect(repartirParCategorie([])).toEqual([]);
    expect(repartirParCategorie([{ categorie: 'autre', prix: 0 }])).toEqual([]);
  });

  it('nomme chaque rayon, meme inconnu', () => {
    expect(libelleCategorieCourse('intendance')).toBe('Intendance');
  });
});
