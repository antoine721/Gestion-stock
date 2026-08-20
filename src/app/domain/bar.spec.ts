import { describe, expect, it } from 'vitest';
import { alcoolsADiluer, diluantDe, regrouperParDiluant } from './bar';

describe('diluants', () => {
  it('donne a chaque alcool son diluant par defaut', () => {
    expect(diluantDe('rhum', new Map())).toBe('coca');
    expect(diluantDe('gin', new Map())).toBe('tonic');
  });

  it('laisse l’organisateur trancher', () => {
    expect(diluantDe('rhum', new Map([['rhum', 'jus-ananas']]))).toBe('jus-ananas');
  });

  it('une chaine vide dit « celui-la, on le boit sec »', () => {
    expect(diluantDe('rhum', new Map([['rhum', '']]))).toBeUndefined();
  });

  it('chiffre le besoin, marge comprise', () => {
    // 100 verres de rhum, 15 cl de coca chacun, +25 % de marge.
    const [rhum] = alcoolsADiluer([{ boissonId: 'rhum', verres: 100 }], new Map());

    expect(rhum.produit?.id).toBe('coca');
    expect(rhum.besoinMl).toBeCloseTo(100 * 150 * 1.25);
    expect(rhum.sec).toBe(false);
  });

  it('le pastis se noie dans cinq volumes', () => {
    const [pastis] = alcoolsADiluer([{ boissonId: 'pastis', verres: 100 }], new Map());

    expect(pastis.produit?.id).toBe('eau-plate');
    expect(pastis.besoinMl).toBeCloseTo(100 * 125 * 1.25);
  });

  it('un shot ne se coupe pas', () => {
    const [jager] = alcoolsADiluer([{ boissonId: 'jager', verres: 50 }], new Map());

    expect(jager.sec).toBe(true);
    expect(jager.produit).toBeUndefined();
    expect(jager.besoinMl).toBe(0);
  });

  it('ne prevoit rien pour un alcool que personne ne boit', () => {
    expect(alcoolsADiluer([{ boissonId: 'rhum', verres: 0 }], new Map())).toEqual([]);
  });

  it('regroupe les alcools qui partagent un diluant', () => {
    // Rhum, captain et whisky se boivent tous au coca : une seule ligne au
    // caddie, mais on sait pour qui elle est.
    const lignes = regrouperParDiluant(
      alcoolsADiluer(
        [
          { boissonId: 'rhum', verres: 40 },
          { boissonId: 'captain', verres: 40 },
          { boissonId: 'gin', verres: 20 },
        ],
        new Map(),
      ),
    );

    const coca = lignes.find((x) => x.produit.id === 'coca');
    expect(coca?.alcools).toHaveLength(2);
    expect(coca?.besoinMl).toBeCloseTo(80 * 150 * 1.25);
    expect(lignes.find((x) => x.produit.id === 'tonic')?.alcools).toEqual(['Gin']);
  });
});
