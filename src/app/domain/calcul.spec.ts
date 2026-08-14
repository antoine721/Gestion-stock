import {
  EntreeCalcul,
  MATERIEL_PAR_DEFAUT,
  buveursDe,
  calculerPanier,
  consoliderCadre,
  consommationDe,
  coutDuMateriel,
  estAlcoolisee,
  invitesDe,
  resoudre,
  resumerPersonnesTypes,
} from './calcul';
import { PROFILS } from './validation';
import { Ajustement, Override, Panier, Participant, PersonneType, VerresBoisson } from './models';

function entree(consommation: VerresBoisson[], options: Partial<EntreeCalcul> = {}): EntreeCalcul {
  return {
    consommation,
    formats: new Map<string, string>(),
    overrides: new Map<string, Override>(),
    ajustements: new Map<string, Ajustement>(),
    materiel: MATERIEL_PAR_DEFAUT,
    jours: 1,
    ...options,
  };
}

function ligne(panier: Panier, produitId: string) {
  return panier.lignes.find((x) => x.produit.id === produitId);
}

const VIDE = { formats: new Map<string, string>(), overrides: new Map<string, Override>() };

const PARTAGE_TEST = {
  nom: 'Test',
  jours: 1,
  profil: 'normal' as const,
  cibles: PROFILS['normal'],
  personnesTypes: [] as PersonneType[],
  formats: [] as [string, string][],
  overrides: [] as [string, Override][],
  ajustements: [] as [string, Ajustement][],
  materiel: MATERIEL_PAR_DEFAUT,
  invites: [],
  nourriture: { repas: [], extras: [] },
  articles: [],
  reponsesFormulaire: [],
  categoriesPaiement: [],
  coursesCochees: [],
};

describe('resoudre', () => {
  it('rend le produit du catalogue par defaut', () => {
    expect(resoudre('biere-33', VIDE.formats, VIDE.overrides)?.contenanceMl).toBe(330);
  });

  it('substitue le conditionnement choisi', () => {
    const formats = new Map([['biere', 'biere-fut-30']]);
    const produit = resoudre('biere-33', formats, VIDE.overrides);

    expect(produit?.id).toBe('biere-fut-30');
    expect(produit?.contenanceMl).toBe(30000);
    expect(produit?.requiertTireuse).toBe(true);
  });

  it('applique le prix et la contenance saisis a la main', () => {
    const overrides = new Map<string, Override>([['whisky', { prixEur: 12, contenanceMl: 1000 }]]);
    const produit = resoudre('whisky', VIDE.formats, overrides);

    expect(produit?.prixEur).toBe(12);
    expect(produit?.contenanceMl).toBe(1000);
    expect(produit?.degre).toBe(40); // le reste du catalogue est intact
  });

  it("corrige le produit substitue, pas le produit d'origine", () => {
    const formats = new Map([['biere', 'biere-fut-20']]);
    const overrides = new Map<string, Override>([['biere-fut-20', { prixEur: 70 }]]);

    expect(resoudre('biere-33', formats, overrides)?.prixEur).toBe(70);
  });
});

describe('calculerPanier', () => {
  it('eclate une recette en ses ingredients', () => {
    // 10 verres de spritz : 900 ml de prosecco, 600 ml d'Aperol, 300 ml d'eau gazeuse.
    const panier = calculerPanier(entree([{ boissonId: 'spritz', verres: 10 }]));

    expect(ligne(panier, 'prosecco')?.mlNecessaire).toBe(900);
    expect(ligne(panier, 'aperol')?.mlNecessaire).toBe(600);
    expect(ligne(panier, 'eau-gazeuse')?.mlNecessaire).toBe(300);
  });

  it('agrege un ingredient partage entre plusieurs boissons', () => {
    // Le prosecco du spritz et celui servi en coupe ne sont achetes qu'une fois.
    const panier = calculerPanier(
      entree([
        { boissonId: 'spritz', verres: 10 },
        { boissonId: 'prosecco-coupe', verres: 10 },
      ]),
    );

    const prosecco = ligne(panier, 'prosecco');
    expect(prosecco?.mlNecessaire).toBe(900 + 1000);
    expect(prosecco?.detail).toHaveLength(2);
  });

  it('arrondit a la bouteille superieure, marge comprise', () => {
    // 20 verres x 40 ml = 800 ml de whisky, +10 % = 880 ml -> 2 bouteilles de 70 cl.
    const panier = calculerPanier(entree([{ boissonId: 'whisky-coca', verres: 20 }]));

    const whisky = ligne(panier, 'whisky');
    expect(whisky?.mlNecessaire).toBe(800);
    expect(whisky?.mlAvecMarge).toBeCloseTo(880);
    expect(whisky?.bouteilles).toBe(2);
    expect(whisky?.resteMl).toBe(600);
  });

  it('applique une marge plus large sur les diluants', () => {
    const panier = calculerPanier(entree([{ boissonId: 'whisky-coca', verres: 10 }]));

    // 1500 ml de coca + 25 % = 1875 ml -> 2 bouteilles de 1,5 L.
    expect(ligne(panier, 'coca')?.bouteilles).toBe(2);
  });

  it('suit le prix corrige a la main', () => {
    const conso: VerresBoisson[] = [{ boissonId: 'whisky-coca', verres: 20 }];
    const catalogue = calculerPanier(entree(conso));
    const corrige = calculerPanier(
      entree(conso, { overrides: new Map([['whisky', { prixEur: 30 }]]) }),
    );

    expect(ligne(corrige, 'whisky')?.prixTotal).toBe(60);
    expect(corrige.coutTotal).toBeGreaterThan(catalogue.coutTotal);
  });

  it('change le nombre de bouteilles quand la contenance change', () => {
    const conso: VerresBoisson[] = [{ boissonId: 'whisky-coca', verres: 20 }];
    // 880 ml de besoin : 2 bouteilles de 70 cl, mais une seule de 1 L.
    const litre = calculerPanier(
      entree(conso, { overrides: new Map([['whisky', { contenanceMl: 1000 }]]) }),
    );

    expect(ligne(litre, 'whisky')?.bouteilles).toBe(1);
  });

  it('sort les bouteilles plaisir du budget de base', () => {
    const ajustements = new Map<string, Ajustement>([
      ['whisky', { plaisir: true, strategie: { type: 'auto' } }],
    ]);
    const panier = calculerPanier(
      entree([{ boissonId: 'whisky-coca', verres: 20 }], { ajustements }),
    );

    expect(panier.coutPlaisir).toBeCloseTo(2 * 17.9);
    expect(panier.coutBase).toBeGreaterThan(0);
    expect(panier.coutTotal).toBeCloseTo(panier.coutBase + panier.coutPlaisir);
  });

  it("accepte un produit que personne n'est prevu pour boire", () => {
    const ajustements = new Map<string, Ajustement>([
      ['jagermeister', { plaisir: true, strategie: { type: 'forfait', bouteilles: 1 } }],
    ]);
    const panier = calculerPanier(entree([], { ajustements }));

    const jagger = ligne(panier, 'jagermeister');
    expect(jagger?.bouteilles).toBe(1);
    expect(jagger?.mlNecessaire).toBe(0);
    expect(panier.coutBase).toBe(0);
  });

  it('respecte une quantite forcee, meme insuffisante', () => {
    const ajustements = new Map<string, Ajustement>([
      ['whisky', { plaisir: false, strategie: { type: 'forfait', bouteilles: 1 } }],
    ]);
    const panier = calculerPanier(
      entree([{ boissonId: 'whisky-coca', verres: 20 }], { ajustements }),
    );

    const whisky = ligne(panier, 'whisky');
    expect(whisky?.bouteilles).toBe(1);
    expect(whisky?.resteMl).toBeLessThan(0); // il manquera 100 ml
  });

  it("compte l'alcool pur sur une echelle commune", () => {
    // 100 bieres de 33 cl a 5 % = 1650 ml d'alcool pur.
    const biere = calculerPanier(entree([{ boissonId: 'biere', verres: 100 }]));
    expect(biere.alcoolPurMl).toBeCloseTo(100 * 330 * 0.05);

    // 100 shots de 4 cl a 37,5 % : presque autant, pour 8x moins de volume.
    const shots = calculerPanier(entree([{ boissonId: 'vodka-shot', verres: 100 }]));
    expect(shots.alcoolPurMl).toBeCloseTo(1500);
    expect(shots.volumeServiMl).toBeLessThan(biere.volumeServiMl);
  });

  it('ne compte pas les boissons sans alcool dans les verres de buveurs', () => {
    const panier = calculerPanier(
      entree([
        { boissonId: 'biere', verres: 20 },
        { boissonId: 'soft-jus', verres: 10 },
      ]),
    );

    expect(panier.verresTotal).toBe(30);
    expect(panier.verresAlcoolises).toBe(20);
    expect(panier.volumeSoftMl).toBe(10 * 200);
  });

  it('bascule la biere en fut et reclame une tireuse', () => {
    const conso: VerresBoisson[] = [{ boissonId: 'biere', verres: 160 }];
    const bouteilles = calculerPanier(entree(conso));
    const fut = calculerPanier(entree(conso, { formats: new Map([['biere', 'biere-fut-30']]) }));

    // 160 bieres x 33 cl = 52,8 L, +10 % = 58 L -> 2 futs de 30 L.
    expect(ligne(fut, 'biere-fut-30')?.bouteilles).toBe(2);
    expect(fut.besoinTireuse).toBe(true);
    expect(bouteilles.besoinTireuse).toBe(false);
    // Moins cher au litre, mais la tireuse peut manger la difference.
    expect(fut.coutBase / fut.volumeAcheteMl).toBeLessThan(
      bouteilles.coutBase / bouteilles.volumeAcheteMl,
    );
  });

  it('ne reclame pas de tireuse pour un mini-fut', () => {
    const panier = calculerPanier(
      entree([{ boissonId: 'biere', verres: 20 }], {
        formats: new Map([['biere', 'biere-fut-5']]),
      }),
    );

    expect(ligne(panier, 'biere-fut-5')).toBeTruthy();
    expect(panier.besoinTireuse).toBe(false);
  });

  it('compte la tireuse comme un cout unique', () => {
    const conso: VerresBoisson[] = [{ boissonId: 'biere', verres: 20 }];
    const location = calculerPanier(
      entree(conso, {
        materiel: { prixTireuse: 75 },
        jours: 3,
      }),
    );

    expect(location.coutMateriel).toBe(75);
    expect(location.coutTotal).toBeCloseTo(location.coutBase + 75);
  });

  it('mesure le reste sur les bras', () => {
    const panier = calculerPanier(entree([{ boissonId: 'whisky-coca', verres: 20 }]));

    // 2 bouteilles de 70 cl achetees pour 80 cl de besoin : 60 cl de reste.
    expect(panier.volumeAcheteMl).toBeGreaterThan(panier.volumeServiMl);
    expect(panier.volumeResteMl).toBeGreaterThan(0);
  });

  it('ne produit aucune ligne sans prediction', () => {
    const panier = calculerPanier(entree([]));
    expect(panier.lignes).toHaveLength(0);
    expect(panier.coutTotal).toBe(0);
  });

  it("n'achete rien pour une boisson a zero verre", () => {
    const panier = calculerPanier(entree([{ boissonId: 'biere', verres: 0 }]));
    expect(panier.lignes).toHaveLength(0);
    expect(panier.verresTotal).toBe(0);
  });
});

describe('coutDuMateriel', () => {
  it('reprend le prix total tel quel, sans le multiplier', () => {
    expect(coutDuMateriel({ prixTireuse: 75 })).toBe(75);
  });

  it('ne coute rien sans tireuse', () => {
    expect(coutDuMateriel(MATERIEL_PAR_DEFAUT)).toBe(0);
  });
});

describe('consolidation par profils', () => {
  const buveurBiere: PersonneType = {
    id: 'p1',
    nom: 'Le buveur de biere',
    description: '',
    emoji: '🍺',
    creeParNom: 'Antoine',
    consommation: [{ boissonId: 'biere', verresParJour: 5 }],
  };
  const abstinent: PersonneType = {
    id: 'p2',
    nom: 'Ne boit pas',
    description: '',
    emoji: '🍺',
    creeParNom: 'Antoine',
    consommation: [{ boissonId: 'soft-jus', verresParJour: 3 }],
  };
  const types = [buveurBiere, abstinent];

  const antoine: Participant = {
    id: 'a',
    nom: 'Antoine',
    effectifs: [
      { personneTypeId: 'p1', nombre: 6 },
      { personneTypeId: 'p2', nombre: 2 },
    ],
  };
  const marie: Participant = {
    id: 'm',
    nom: 'Marie',
    effectifs: [{ personneTypeId: 'p1', nombre: 4 }],
  };

  it("deduit le nombre d'invites des effectifs", () => {
    expect(invitesDe(antoine)).toBe(8);
    expect(invitesDe(marie)).toBe(4);
  });

  it('deduit les buveurs du contenu des profils', () => {
    expect(estAlcoolisee(buveurBiere)).toBe(true);
    expect(estAlcoolisee(abstinent)).toBe(false);
    expect(buveursDe(antoine, types)).toBe(6);
  });

  it('multiplie les verres par les effectifs et par les jours', () => {
    // 10 buveurs de biere x 5 verres x 2 jours = 100 bieres.
    const conso = consommationDe([antoine, marie], types, 2);
    expect(conso.find((x) => x.boissonId === 'biere')?.verres).toBe(100);
    expect(conso.find((x) => x.boissonId === 'soft-jus')?.verres).toBe(12);
  });

  it('cumule un profil utilise par plusieurs co-organisateurs', () => {
    const conso = consommationDe([antoine, marie], types, 1);
    expect(conso.filter((x) => x.boissonId === 'biere')).toHaveLength(1);
    expect(conso[0].verres).toBe(50);
  });

  it('ignore un effectif qui vise un profil supprime', () => {
    const orphelin: Participant = {
      id: 'x',
      nom: 'X',
      effectifs: [{ personneTypeId: 'disparu', nombre: 10 }],
    };
    expect(consommationDe([orphelin], types, 1)).toHaveLength(0);
    // L'invite compte quand meme comme une tete a nourrir.
    expect(invitesDe(orphelin)).toBe(10);
  });

  it('consolide le cadre sans aucune saisie manuelle', () => {
    const cadre = consoliderCadre([antoine, marie], {
      ...PARTAGE_TEST,
      personnesTypes: types,
    });

    expect(cadre.invites).toBe(12);
    // 10 buveurs sur 12 invites.
    expect(cadre.partBuveurs).toBeCloseTo(10 / 12);
  });

  it('resume ce que chaque profil pese', () => {
    const resumes = resumerPersonnesTypes([antoine, marie], types);
    const biere = resumes.find((x) => x.personneType.id === 'p1');

    expect(biere?.effectif).toBe(10);
    expect(biere?.verresParJour).toBe(5);
    expect(biere?.alcoolisee).toBe(true);
  });
});
