import { describe, expect, it } from 'vitest';
import { goutsIntraduisibles } from './interpretation';
import {
  BOISSONS_AIMEES,
  boissonsBues,
  repartirGouts,
  boissonsDeFamille,
  libelleBoissonsAimees,
  normaliserGouts,
} from './preferences';

describe('repartirGouts', () => {
  const somme = (parts: Map<string, number>) => [...parts.values()].reduce((a, b) => a + b, 0);

  it('donne tout a la premiere boisson servie', () => {
    expect(repartirGouts(new Map(), 'biere-blonde', 40)).toEqual(new Map([['biere-blonde', 100]]));
  });

  it('prend aux autres ce qu on donne a l un', () => {
    const parts = new Map([
      ['biere-blonde', 50],
      ['biere-blanche', 50],
    ]);
    const apres = repartirGouts(parts, 'biere-blonde', 80);

    expect(apres.get('biere-blonde')).toBe(80);
    expect(apres.get('biere-blanche')).toBe(20);
    expect(somme(apres)).toBe(100);
  });

  it('rend aux autres ce qu on retire a l un', () => {
    const parts = new Map([
      ['biere-blonde', 60],
      ['biere-blanche', 20],
      ['biere-rouge', 20],
    ]);
    const apres = repartirGouts(parts, 'biere-blonde', 20);

    expect(apres.get('biere-blonde')).toBe(20);
    // Les deux autres se partagent les 80 restants, a parts egales.
    expect(apres.get('biere-blanche')).toBe(40);
    expect(apres.get('biere-rouge')).toBe(40);
    expect(somme(apres)).toBe(100);
  });

  it('avance par crans de 5, jamais par miettes', () => {
    const parts = new Map([
      ['biere-blonde', 34],
      ['biere-blanche', 33],
      ['biere-rouge', 33],
    ]);
    const apres = repartirGouts(parts, 'biere-blonde', 52);

    expect(apres.get('biere-blonde')).toBe(50);
    for (const part of apres.values()) expect(part % 5).toBe(0);
    expect(somme(apres)).toBe(100);
  });

  it('tombe a zero sous le premier cran', () => {
    const parts = new Map([
      ['biere-blonde', 50],
      ['biere-blanche', 50],
    ]);
    const apres = repartirGouts(parts, 'biere-blonde', 2);

    expect(apres.has('biere-blonde')).toBe(false);
    expect(apres.get('biere-blanche')).toBe(100);
  });

  it('ne laisse pas une poussiere de part a une boisson', () => {
    // Une part qui tomberait sous 5 % passe a zero, sa place va au plus gros.
    const parts = new Map([
      ['rhum', 90],
      ['gin', 5],
      ['vodka', 5],
    ]);
    const apres = repartirGouts(parts, 'rhum', 95);

    expect(apres.get('rhum')).toBe(95);
    expect(somme(apres)).toBe(100);
    for (const part of apres.values()) expect(part).toBeGreaterThanOrEqual(5);
  });

  it('vide la famille quand le dernier curseur tombe a zero', () => {
    expect(repartirGouts(new Map([['rhum', 100]]), 'rhum', 0).size).toBe(0);
  });

  it('sature a 100', () => {
    const apres = repartirGouts(
      new Map([
        ['rhum', 50],
        ['gin', 50],
      ]),
      'rhum',
      100,
    );
    expect(apres).toEqual(new Map([['rhum', 100]]));
  });
});

describe('normaliserGouts', () => {
  it('remonte les vieilles notes de 0 a 4', () => {
    expect(normaliserGouts([{ boissonId: 'biere', intensite: 3 }])).toEqual([
      { boissonId: 'biere', intensite: 75 },
    ]);
  });

  it('laisse les parts telles quelles', () => {
    expect(normaliserGouts([{ boissonId: 'gin', intensite: 45 }])).toEqual([
      { boissonId: 'gin', intensite: 45 },
    ]);
    expect(normaliserGouts([{ boissonId: 'gin', intensite: 0 }])).toEqual([]);
    expect(normaliserGouts(undefined)).toEqual([]);
  });
});

describe('libelleBoissonsAimees', () => {
  it('liste les parts, la plus grosse en tete', () => {
    const texte = libelleBoissonsAimees([
      { boissonId: 'rhum', intensite: 25 },
      { boissonId: 'vin-rouge', intensite: 0 },
      { boissonId: 'biere-blonde', intensite: 75 },
    ]);
    expect(texte).toBe('Biere blonde 75 % · Rhum 25 %');
  });
});

describe('les bieres', () => {
  it('se declinent en blonde, blanche et rouge', () => {
    const bieres = boissonsDeFamille('biere').map((x) => x.id);
    expect(bieres).toContain('biere-blonde');
    expect(bieres).toContain('biere-blanche');
    expect(bieres).toContain('biere-rouge');
    // L'ancien gout generique reste : les fiches deja remplies le portent.
    expect(bieres).toContain('biere');
  });

  it('ne laisse aucun identifiant en double', () => {
    const ids = BOISSONS_AIMEES.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('boissonsBues', () => {
  it('classe par part et ecarte les inconnues', () => {
    expect(
      boissonsBues([
        { boissonId: 'rhum', intensite: 30 },
        { boissonId: 'absinthe', intensite: 100 },
        { boissonId: 'biere-blonde', intensite: 70 },
      ]),
    ).toEqual([
      { libelle: 'Biere blonde', part: 70 },
      { libelle: 'Rhum', part: 30 },
    ]);
  });

  it('ne rend rien sans declaration', () => {
    expect(boissonsBues([])).toEqual([]);
  });
});

describe('les bieres declinees', () => {
  it('se traduisent toutes en biere du catalogue', () => {
    // Sans cette traduction, declarer « biere blonde » ne mettait aucune biere
    // dans les courses : le gout etait juste signale comme intraduisible.
    expect(goutsIntraduisibles([{ boissonId: 'biere-blonde', intensite: 70 }])).toEqual([]);
    expect(goutsIntraduisibles([{ boissonId: 'biere-blanche', intensite: 70 }])).toEqual([]);
    expect(goutsIntraduisibles([{ boissonId: 'biere-rouge', intensite: 70 }])).toEqual([]);
  });

  it('le kir aussi : il existe au catalogue, blanc et cassis', () => {
    expect(goutsIntraduisibles([{ boissonId: 'kir', intensite: 50 }])).toEqual([]);
    expect(boissonsDeFamille('vin').map((x) => x.id)).toContain('kir');
  });
});
