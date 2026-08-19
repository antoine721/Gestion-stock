import { describe, expect, it } from 'vitest';
import { goutsIntraduisibles } from './interpretation';
import {
  BOISSONS_AIMEES,
  alcoolPrefere,
  boissonsDeFamille,
  libelleBoissonsAimees,
  libelleIntensite,
  normaliserGouts,
} from './preferences';

describe('le curseur de gout, en pourcentage', () => {
  it('met un mot sur chaque tranche', () => {
    expect(libelleIntensite(0)).toBe("J'en bois pas");
    expect(libelleIntensite(5)).toBe('De temps en temps');
    expect(libelleIntensite(25)).toBe("J'aime bien");
    expect(libelleIntensite(60)).toBe('Je suis fan');
    expect(libelleIntensite(100)).toBe('Je bois que ca');
  });

  it('borne ce qui sort de l’echelle', () => {
    expect(libelleIntensite(-10)).toBe("J'en bois pas");
    expect(libelleIntensite(500)).toBe('Je bois que ca');
  });
});

describe('normaliserGouts', () => {
  it('remonte les fiches notees de 0 a 4 a l’echelle en pourcentage', () => {
    expect(normaliserGouts([{ boissonId: 'biere', intensite: 4 }])).toEqual([
      { boissonId: 'biere', intensite: 100 },
    ]);
    expect(normaliserGouts([{ boissonId: 'rhum', intensite: 1 }])).toEqual([
      { boissonId: 'rhum', intensite: 25 },
    ]);
  });

  it('laisse tranquille ce qui est deja un pourcentage', () => {
    // Le curseur avance de 5 en 5 : aucune saisie actuelle ne tombe entre 1 et 4.
    expect(normaliserGouts([{ boissonId: 'gin', intensite: 45 }])).toEqual([
      { boissonId: 'gin', intensite: 45 },
    ]);
    expect(normaliserGouts([{ boissonId: 'gin', intensite: 0 }])).toEqual([
      { boissonId: 'gin', intensite: 0 },
    ]);
  });

  it('accepte une liste absente', () => {
    expect(normaliserGouts(undefined)).toEqual([]);
  });
});

describe('libelleBoissonsAimees', () => {
  it('affiche le pourcentage et ignore les gouts a zero', () => {
    const texte = libelleBoissonsAimees([
      { boissonId: 'biere-blonde', intensite: 75 },
      { boissonId: 'vin-rouge', intensite: 0 },
      { boissonId: 'rhum', intensite: 2 },
    ]);
    expect(texte).toBe('Biere blonde (75 %) · Rhum (50 %)');
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

describe('alcoolPrefere', () => {
  it('sort la boisson qui porte la plus grosse part', () => {
    expect(
      alcoolPrefere([
        { boissonId: 'biere-blonde', intensite: 40 },
        { boissonId: 'rhum', intensite: 80 },
        { boissonId: 'gin', intensite: 0 },
      ]),
    ).toEqual({ boissonId: 'rhum', libelle: 'Rhum', part: 80 });
  });

  it('lit aussi les fiches notees de 0 a 4', () => {
    expect(alcoolPrefere([{ boissonId: 'biere', intensite: 2 }])?.part).toBe(50);
  });

  it('tranche les egalites par l’ordre du catalogue', () => {
    const premier = alcoolPrefere([
      { boissonId: 'vodka', intensite: 50 },
      { boissonId: 'biere-blonde', intensite: 50 },
    ]);
    expect(premier?.boissonId).toBe('biere-blonde');
  });

  it('ne renvoie rien quand rien n’est declare', () => {
    expect(alcoolPrefere([])).toBeUndefined();
    expect(alcoolPrefere([{ boissonId: 'biere', intensite: 0 }])).toBeUndefined();
    // Un gout inconnu du catalogue ne peut pas etre affiche.
    expect(alcoolPrefere([{ boissonId: 'absinthe', intensite: 90 }])).toBeUndefined();
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
});
