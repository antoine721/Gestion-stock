import { describe, expect, it } from 'vitest';
import { goutsIntraduisibles } from './interpretation';
import {
  BOISSONS_AIMEES,
  basculerGout,
  boissonsBues,
  boitCa,
  boissonsDeFamille,
  libelleBoissonsAimees,
  normaliserGouts,
} from './preferences';

describe('les gouts se cochent', () => {
  it('ramene toute ancienne nuance a une case cochee', () => {
    // Les fiches d'avant portaient un dosage : 0 a 4, puis un pourcentage.
    expect(normaliserGouts([{ boissonId: 'biere', intensite: 3 }])).toEqual([
      { boissonId: 'biere', intensite: 100 },
    ]);
    expect(normaliserGouts([{ boissonId: 'gin', intensite: 45 }])).toEqual([
      { boissonId: 'gin', intensite: 100 },
    ]);
  });

  it('laisse tomber ce qui est a zero', () => {
    expect(normaliserGouts([{ boissonId: 'gin', intensite: 0 }])).toEqual([]);
    expect(normaliserGouts(undefined)).toEqual([]);
  });

  it('coche et decoche', () => {
    const apres = basculerGout([], 'rhum');
    expect(boitCa(apres, 'rhum')).toBe(true);
    expect(boitCa(basculerGout(apres, 'rhum'), 'rhum')).toBe(false);
  });
});

describe('libelleBoissonsAimees', () => {
  it('liste ce qui est coche, dans l ordre de la liste', () => {
    const texte = libelleBoissonsAimees([
      { boissonId: 'rhum', intensite: 2 },
      { boissonId: 'vin-rouge', intensite: 0 },
      { boissonId: 'biere-blonde', intensite: 75 },
    ]);
    expect(texte).toBe('Biere blonde · Rhum');
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
  it('rend les boissons cochees, les inconnues en moins', () => {
    expect(
      boissonsBues([
        { boissonId: 'rhum', intensite: 100 },
        { boissonId: 'absinthe', intensite: 100 },
        { boissonId: 'biere-blonde', intensite: 100 },
      ]),
    ).toEqual(['Biere blonde', 'Rhum']);
  });

  it('ne rend rien quand rien n est coche', () => {
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
