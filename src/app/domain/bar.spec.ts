import { describe, expect, it } from 'vitest';
import { alcoolsADiluer, diluantsDe, regrouperCocktails, regrouperParDiluant } from './bar';
import { MATERIEL_PAR_DEFAUT, calculerPanier } from './calcul';
import { Ajustement, Override, VerresBoisson } from './models';

function panier(consommation: VerresBoisson[]) {
  return calculerPanier({
    consommation,
    formats: new Map<string, string>(),
    overrides: new Map<string, Override>(),
    ajustements: new Map<string, Ajustement>(),
    materiel: MATERIEL_PAR_DEFAUT,
    jours: 1,
  });
}

describe('diluants', () => {
  it('donne a chaque alcool son diluant par defaut', () => {
    expect(diluantsDe('rhum', new Map())).toEqual(['coca']);
    expect(diluantsDe('gin', new Map())).toEqual(['tonic']);
  });

  it('laisse l’organisateur trancher', () => {
    expect(diluantsDe('rhum', new Map([['rhum', 'jus-ananas']]))).toEqual(['jus-ananas']);
  });

  it('accepte plusieurs diluants sur un meme alcool', () => {
    const choix = new Map([['vodka', ['jus-orange', 'red-bull']]]);

    expect(diluantsDe('vodka', choix)).toEqual(['jus-orange', 'red-bull']);
  });

  it('ignore les doublons et les produits inconnus', () => {
    const choix = new Map([['rhum', ['coca', 'coca', 'jus-de-chaussette']]]);

    expect(diluantsDe('rhum', choix)).toEqual(['coca']);
  });

  it('une liste vide dit « celui-la, on le boit sec »', () => {
    expect(diluantsDe('rhum', new Map([['rhum', []]]))).toEqual([]);
    // Les fiches d'avant n'ecrivaient qu'une chaine : elle se relit toujours.
    expect(diluantsDe('rhum', new Map([['rhum', '']]))).toEqual([]);
  });

  it('chiffre le besoin, marge comprise', () => {
    // 100 verres de rhum, 15 cl de coca chacun, +25 % de marge.
    const [rhum] = alcoolsADiluer([{ boissonId: 'rhum', verres: 100 }], new Map());

    expect(rhum.diluants).toHaveLength(1);
    expect(rhum.diluants[0].produit.id).toBe('coca');
    expect(rhum.besoinMl).toBeCloseTo(100 * 150 * 1.25);
    expect(rhum.sec).toBe(false);
  });

  it('partage le besoin entre les diluants d’un meme alcool', () => {
    // Deux diluants, ce n'est pas deux fois plus a boire : c'est un verre au
    // jus et le suivant au Red Bull.
    const choix = new Map([['vodka', ['jus-orange', 'red-bull']]]);
    const [vodka] = alcoolsADiluer([{ boissonId: 'vodka', verres: 100 }], choix);

    expect(vodka.besoinMl).toBeCloseTo(100 * 150 * 1.25);
    expect(vodka.diluants.map((x) => x.produit.id)).toEqual(['jus-orange', 'red-bull']);
    for (const diluant of vodka.diluants) {
      expect(diluant.besoinMl).toBeCloseTo((100 * 150 * 1.25) / 2);
    }
  });

  it('reprend le prix et la contenance corriges a la main', () => {
    const overrides = new Map([['coca', { prixEur: 2.5, contenanceMl: 2000 }]]);
    const [rhum] = alcoolsADiluer(
      [{ boissonId: 'rhum', verres: 10 }],
      new Map(),
      undefined,
      overrides,
    );

    expect(rhum.diluants[0].produit.prixEur).toBe(2.5);
    expect(rhum.diluants[0].produit.contenanceMl).toBe(2000);
  });

  it('le pastis se noie dans cinq volumes', () => {
    const [pastis] = alcoolsADiluer([{ boissonId: 'pastis', verres: 100 }], new Map());

    expect(pastis.diluants[0].produit.id).toBe('eau-plate');
    expect(pastis.besoinMl).toBeCloseTo(100 * 125 * 1.25);
  });

  it('un shot ne se coupe pas', () => {
    const [jager] = alcoolsADiluer([{ boissonId: 'jager', verres: 50 }], new Map());

    expect(jager.sec).toBe(true);
    expect(jager.diluants).toEqual([]);
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

  it('additionne les parts quand deux alcools partagent le meme second diluant', () => {
    const choix = new Map([
      ['rhum', ['coca', 'jus-ananas']],
      ['vodka', ['jus-orange', 'jus-ananas']],
    ]);
    const lignes = regrouperParDiluant(
      alcoolsADiluer(
        [
          { boissonId: 'rhum', verres: 20 },
          { boissonId: 'vodka', verres: 20 },
        ],
        choix,
      ),
    );

    const ananas = lignes.find((x) => x.produit.id === 'jus-ananas');
    expect(ananas?.alcools).toEqual(['Rhum', 'Vodka']);
    expect(ananas?.besoinMl).toBeCloseTo(2 * ((20 * 150 * 1.25) / 2));
  });
});

describe('recettes composees', () => {
  it('range les ingredients du spritz sous leur cocktail', () => {
    const consommation = [{ boissonId: 'spritz', verres: 40 }];
    const { groupes, autres } = regrouperCocktails(panier(consommation).lignes, consommation);

    expect(groupes).toHaveLength(1);
    expect(groupes[0].nom).toBe('Spritz');
    expect(groupes[0].lignes.map((x) => x.produit.id)).toEqual(['prosecco', 'aperol']);
    // L'eau petillante ne s'achete pas par le calcul : elle part aux diluants.
    expect(groupes[0].rappels).toEqual([{ nom: 'Eau gazeuse (1 L)', ml: 40 * 30, ou: 'diluants' }]);
    expect(autres).toEqual([]);
  });

  it('garde une ligne par ingredient, jamais une ligne fusionnee', () => {
    const consommation = [{ boissonId: 'kir', verres: 30 }];
    const { groupes } = regrouperCocktails(panier(consommation).lignes, consommation);

    expect(groupes[0].lignes.map((x) => x.produit.id).sort()).toEqual([
      'creme-cassis',
      'vin-blanc',
    ]);
  });

  it('laisse dans la liste generale ce qu’on boit surtout autrement', () => {
    // Dix verres de vin blanc pour deux kirs : la bouteille s'achete pour le
    // vin blanc. Le groupe n'en garde qu'un rappel, sans la compter deux fois.
    const consommation = [
      { boissonId: 'kir', verres: 2 },
      { boissonId: 'vin-blanc', verres: 30 },
    ];
    const { groupes, autres } = regrouperCocktails(panier(consommation).lignes, consommation);

    expect(groupes[0].lignes.map((x) => x.produit.id)).toEqual(['creme-cassis']);
    expect(groupes[0].rappels).toEqual([{ nom: 'Vin blanc', ml: 2 * 100, ou: 'liste' }]);
    expect(autres.map((x) => x.produit.id)).toContain('vin-blanc');
  });

  it('ne montre aucun groupe sans cocktail au programme', () => {
    const consommation = [{ boissonId: 'biere', verres: 50 }];
    const { groupes, autres } = regrouperCocktails(panier(consommation).lignes, consommation);

    expect(groupes).toEqual([]);
    expect(autres).toHaveLength(panier(consommation).lignes.length);
  });

  it('n’attribue jamais la meme bouteille a deux groupes', () => {
    const consommation = [
      { boissonId: 'kir', verres: 20 },
      { boissonId: 'spritz', verres: 20 },
    ];
    const lignes = panier(consommation).lignes;
    const { groupes, autres } = regrouperCocktails(lignes, consommation);

    const groupees = groupes.flatMap((x) => x.lignes.map((y) => y.produit.id));
    expect(new Set(groupees).size).toBe(groupees.length);
    expect([...groupees, ...autres.map((x) => x.produit.id)].sort()).toEqual(
      lignes.map((x) => x.produit.id).sort(),
    );
  });
});
