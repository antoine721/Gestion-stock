import { describe, expect, it } from 'vitest';
import { formatContenance, libelleQuantite, totalContenance } from './unites-achat';

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
