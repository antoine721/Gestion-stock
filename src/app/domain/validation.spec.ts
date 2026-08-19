import { MATERIEL_PAR_DEFAUT, calculerPanier } from './calcul';
import { PROFILS, calculerAlertes, calculerRatios, etatDe } from './validation';
import { Ajustement, Cadre, Materiel, Override, Panier, Ratio, VerresBoisson } from './models';

const CADRE: Cadre = { invites: 30, jours: 1, partBuveurs: 0.8, profil: 'normal' };

function panierDe(
  consommation: VerresBoisson[],
  options: {
    formats?: Map<string, string>;
    ajustements?: Map<string, Ajustement>;
    materiel?: Materiel;
    jours?: number;
  } = {},
): Panier {
  return calculerPanier({
    consommation,
    formats: options.formats ?? new Map(),
    overrides: new Map<string, Override>(),
    ajustements: options.ajustements ?? new Map(),
    materiel: options.materiel ?? MATERIEL_PAR_DEFAUT,
    jours: options.jours ?? 1,
  });
}

function ratios(consommation: VerresBoisson[], cadre: Cadre = CADRE): Ratio[] {
  return calculerRatios(cadre, PROFILS[cadre.profil], panierDe(consommation));
}

function ratio(liste: Ratio[], id: string): Ratio {
  const trouve = liste.find((x) => x.id === id);
  if (!trouve) throw new Error(`ratio ${id} absent`);
  return trouve;
}

describe('etatDe', () => {
  it("tolere 15 % d'ecart autour d'une cible", () => {
    expect(etatDe(4.5, 4.5, 'cible')).toBe('ok');
    expect(etatDe(5, 4.5, 'cible')).toBe('ok');
    expect(etatDe(6, 4.5, 'cible')).toBe('warn');
    expect(etatDe(9, 4.5, 'cible')).toBe('ko');
  });

  it('ne penalise que le sous-dimensionnement pour un mini', () => {
    expect(etatDe(4, 2.5, 'min')).toBe('ok');
    expect(etatDe(2, 2.5, 'min')).toBe('warn');
    expect(etatDe(0.5, 2.5, 'min')).toBe('ko');
  });

  it('ne penalise que le depassement pour un maxi', () => {
    expect(etatDe(30, 50, 'max')).toBe('ok');
    expect(etatDe(60, 50, 'max')).toBe('warn');
    expect(etatDe(90, 50, 'max')).toBe('ko');
  });
});

describe('calculerRatios', () => {
  it('ramene les verres au buveur et au jour', () => {
    // 24 buveurs, 108 verres -> 4,5 verres/buveur/jour, pile la cible du profil normal.
    const liste = ratios([{ boissonId: 'biere', verres: 108 }]);
    const verres = ratio(liste, 'verres');

    expect(verres.valeur).toBeCloseTo(4.5);
    expect(verres.etat).toBe('ok');
  });

  it('divise par le nombre de jours', () => {
    const surTroisJours: Cadre = { ...CADRE, jours: 3 };
    const liste = ratios([{ boissonId: 'biere', verres: 324 }], surTroisJours);

    expect(ratio(liste, 'verres').valeur).toBeCloseTo(4.5);
  });

  it('exclut les boissons sans alcool du ratio de verres', () => {
    const liste = ratios([
      { boissonId: 'biere', verres: 108 },
      { boissonId: 'soft-jus', verres: 24 },
    ]);

    expect(ratio(liste, 'verres').valeur).toBeCloseTo(4.5);
  });

  it('separe deux soirees au meme nombre de verres', () => {
    // Autant de verres de part et d'autre, mais pas la meme dose par verre :
    // c'est exactement ce que le ratio d'alcool pur sert a rendre visible.
    const spiritueux = ratios([{ boissonId: 'vodka-shot', verres: 108 }]);
    const bulles = ratios([{ boissonId: 'prosecco-coupe', verres: 108 }]);

    expect(ratio(spiritueux, 'verres').valeur).toBeCloseTo(ratio(bulles, 'verres').valeur);
    expect(ratio(spiritueux, 'alcool-pur').valeur).toBeGreaterThan(
      ratio(bulles, 'alcool-pur').valeur * 1.3,
    );
  });

  it("alerte quand il n'y a pas assez de diluant", () => {
    const liste = ratios([{ boissonId: 'whisky-sec', verres: 108 }]);
    expect(ratio(liste, 'diluant').etat).toBe('ko');
  });

  it('ignore le ratio de diluant sur une soiree sans spiritueux', () => {
    // La biere et le vin ne se coupent pas : le rapport n'a rien a dire.
    const liste = ratios([{ boissonId: 'biere', verres: 108 }]);
    expect(ratio(liste, 'diluant').etat).toBe('vide');
  });

  it('signale une soiree monolithique', () => {
    const liste = ratios([{ boissonId: 'biere', verres: 108 }]);
    const dominante = ratio(liste, 'dominante');

    expect(dominante.valeur).toBeCloseTo(100);
    expect(dominante.etat).toBe('ko');
  });

  it('reclame du sans-alcool quand des invites ne boivent pas', () => {
    const sansSoft = ratios([{ boissonId: 'biere', verres: 108 }]);
    expect(ratio(sansSoft, 'soft').etat).toBe('ko');

    const avecSoft = ratios([
      { boissonId: 'biere', verres: 108 },
      { boissonId: 'soft-jus', verres: 24 },
    ]);
    expect(ratio(avecSoft, 'soft').etat).toBe('ok');
  });

  it('ne pose pas la question du sans-alcool si tout le monde boit', () => {
    const tousBuveurs: Cadre = { ...CADRE, partBuveurs: 1 };
    const liste = ratios([{ boissonId: 'biere', verres: 135 }], tousBuveurs);

    expect(ratio(liste, 'soft').etat).toBe('vide');
  });

  it("designe les boissons responsables d'un ecart", () => {
    const liste = ratios([
      { boissonId: 'biere', verres: 240 },
      { boissonId: 'rose', verres: 4 },
    ]);
    const verres = ratio(liste, 'verres');

    expect(verres.etat).toBe('ko');
    expect(verres.contributeurs[0].nom).toBe('Biere');
    expect(verres.contributeurs[0].part).toBeGreaterThan(80);
  });

  it('ne casse pas sur une prediction vide', () => {
    for (const r of ratios([])) {
      expect(Number.isFinite(r.valeur)).toBe(true);
      expect(r.etat).toBe('vide');
    }
  });
});

describe('calculerAlertes', () => {
  function messages(alertes: ReturnType<typeof calculerAlertes>): string[] {
    return alertes.map((x) => x.id);
  }

  it('exige une tireuse pour un fut pression', () => {
    const panier = panierDe([{ boissonId: 'biere', verres: 108 }], {
      formats: new Map([['biere', 'biere-fut-30']]),
    });

    expect(messages(calculerAlertes(CADRE, panier, 0))).toContain('tireuse');
    expect(messages(calculerAlertes(CADRE, panier, 90))).not.toContain('tireuse');
  });

  it('signale une tireuse payee pour rien', () => {
    const panier = panierDe([{ boissonId: 'biere', verres: 108 }]);
    expect(messages(calculerAlertes(CADRE, panier, 90))).toContain('tireuse-inutile');
  });

  it('signale une quantite forcee insuffisante', () => {
    const panier = panierDe([{ boissonId: 'whisky-coca', verres: 20 }], {
      ajustements: new Map([
        ['whisky', { plaisir: false, strategie: { type: 'forfait', bouteilles: 1 } }],
      ]),
    });

    expect(messages(calculerAlertes(CADRE, panier, 0))).toContain('manque');
  });

  it('signale ce qui ne passera pas la nuit sur un evenement long', () => {
    const surTroisJours: Cadre = { ...CADRE, jours: 3 };
    // Un fut perce s'oxyde en quelques jours : c'est le cas type.
    const panier = panierDe([{ boissonId: 'biere', verres: 40 }], {
      formats: new Map([['biere', 'biere-fut-20']]),
    });

    expect(messages(calculerAlertes(surTroisJours, panier, 0))).toContain('conservation');
    expect(messages(calculerAlertes(CADRE, panier, 0))).not.toContain('conservation');
  });

  it('signale les non-buveurs oublies', () => {
    const panier = panierDe([{ boissonId: 'biere', verres: 108 }]);
    expect(messages(calculerAlertes(CADRE, panier, 0))).toContain('sans-soft');
  });

  it('ne dit rien sur un panier vide', () => {
    expect(calculerAlertes(CADRE, panierDe([]), 0)).toHaveLength(0);
  });
});
