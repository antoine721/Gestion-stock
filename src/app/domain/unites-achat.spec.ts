import { describe, expect, it } from 'vitest';
import {
  formatContenance,
  libelleQuantite,
  lireConditionnement,
  totalContenance,
} from './unites-achat';

describe('la ligne de courses se lit devant le rayon', () => {
  it('compte a la piece quand il n’y a pas de contenant', () => {
    expect(libelleQuantite(4, 0, 'piece')).toBe('× 4');
  });

  it('donne le poids du contenant quand il y en a un', () => {
    expect(libelleQuantite(2, 10, 'kg')).toBe('2 × 10 kg');
    expect(libelleQuantite(3, 1.5, 'L')).toBe('3 × 1,5 L');
  });

  it('ne colle pas un poids a un article compte a la piece', () => {
    expect(formatContenance(12, 'piece')).toBe('');
    expect(libelleQuantite(6, 12, 'piece')).toBe('× 6');
  });

  it('additionne pour dire ce que ca fait en tout', () => {
    expect(totalContenance(4, 1.5, 'L')).toBe('6 L');
    // Un seul contenant : le total repeterait la contenance, il ne dit rien.
    expect(totalContenance(1, 1.5, 'L')).toBe('');
    expect(totalContenance(4, 0, 'piece')).toBe('');
  });

  it('remonte d’unite quand le total depasse le millier', () => {
    // Deux bidons de 500 ml font un litre, pas « 1000 ml ».
    expect(totalContenance(2, 500, 'ml')).toBe('1 L');
    expect(totalContenance(4, 750, 'ml')).toBe('3 L');
    expect(totalContenance(3, 500, 'g')).toBe('1,5 kg');
    // En dessous, l'unite de l'etiquette reste la plus parlante.
    expect(totalContenance(2, 250, 'ml')).toBe('500 ml');
  });
});

describe('lecture du conditionnement d’Open Food Facts', () => {
  it('lit les etiquettes courantes', () => {
    expect(lireConditionnement('1,5 L')).toEqual({ contenance: 1.5, unite: 'L' });
    expect(lireConditionnement('500 g')).toEqual({ contenance: 500, unite: 'g' });
    expect(lireConditionnement('75 cl')).toEqual({ contenance: 750, unite: 'ml' });
    expect(lireConditionnement('10kg')).toEqual({ contenance: 10, unite: 'kg' });
  });

  it('remonte a l’unite superieure quand l’etiquette s’ignore', () => {
    // 1500 g est un 1,5 kg qui n'a pas ete ecrit comme tel.
    expect(lireConditionnement('1500 g')).toEqual({ contenance: 1.5, unite: 'kg' });
    expect(lireConditionnement('100 cl')).toEqual({ contenance: 1, unite: 'L' });
  });

  it('lit un pack par son contenant, pas par son total', () => {
    // C'est le pack qu'on met dans le caddie ; la quantite de la ligne dira
    // combien de packs.
    expect(lireConditionnement('6 x 33 cl')).toEqual({ contenance: 330, unite: 'ml' });
  });

  it('revient a la piece quand rien ne se lit', () => {
    expect(lireConditionnement('12 rouleaux')).toEqual({ contenance: 0, unite: 'piece' });
    expect(lireConditionnement('')).toEqual({ contenance: 0, unite: 'piece' });
    expect(lireConditionnement('format familial')).toEqual({ contenance: 0, unite: 'piece' });
  });
});
