import { TestBed } from '@angular/core/testing';
import { ONGLET_EVENEMENT, PARTAGE_INITIAL, PlannerStore } from './planner-store';
import { Api, EvenementDistant } from './api';
import { Participant, PersonneType } from '../domain/models';

const BUVEUR_BIERE: PersonneType = {
  id: 'p1',
  nom: 'Le buveur de biere',
  description: 'Une biere a la main toute la soiree.',
  emoji: '🍺',
  creeParNom: 'Antoine',
  consommation: [{ boissonId: 'biere', verresParJour: 5 }],
};

const TEAM_SPRITZ: PersonneType = {
  id: 'p2',
  nom: 'La team spritz',
  description: '',
  emoji: '🍺',
  creeParNom: 'Marie',
  consommation: [{ boissonId: 'spritz', verresParJour: 3 }],
};

const ABSTINENT: PersonneType = {
  id: 'p3',
  nom: 'Ne boit pas',
  description: '',
  emoji: '🍺',
  creeParNom: 'Antoine',
  consommation: [{ boissonId: 'soft-jus', verresParJour: 3 }],
};

function participant(id: string, nom: string, effectifs: [string, number][]): Participant {
  return {
    id,
    nom,
    effectifs: effectifs.map(([personneTypeId, nombre]) => ({ personneTypeId, nombre })),
  };
}

/** Api bouchonnee : on teste la consolidation, pas le reseau. */
class ApiFausse {
  evenement: EvenementDistant = {
    code: 'test1234',
    partage: { ...PARTAGE_INITIAL, personnesTypes: [BUVEUR_BIERE, TEAM_SPRITZ, ABSTINENT] },
    participants: [],
  };
  participantsEnregistres: string[] = [];

  async charger() {
    return this.evenement;
  }
  async enregistrerPartage() {
    return { ok: true as const };
  }
  async enregistrerParticipant(_code: string, _mdp: string, p: Participant) {
    this.participantsEnregistres.push(p.id);
    return { ok: true as const };
  }
  async rejoindre() {
    return { id: 'a', nom: 'Antoine', deja: false };
  }
  async retirerParticipant() {
    return { ok: true as const };
  }
  async creer() {
    return { code: 'test1234', participantId: 'a' };
  }
}

describe('PlannerStore', () => {
  let api: ApiFausse;
  let store: PlannerStore;

  beforeEach(async () => {
    localStorage.clear();
    api = new ApiFausse();
    api.evenement.participants = [
      participant('a', 'Antoine', [
        ['p1', 6],
        ['p3', 2],
      ]),
      participant('m', 'Marie', [['p2', 4]]),
    ];

    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: api }] });
    store = TestBed.inject(PlannerStore);
    await store.ouvrir('test1234');
    store.moiId.set('a');
  });

  afterEach(() => store.fermer());

  it('deduit les invites et les buveurs des effectifs', () => {
    expect(store.cadre().invites).toBe(12);
    // 6 buveurs de biere + 4 spritz ; les 2 abstinents ne comptent pas.
    expect(store.buveurs()).toBe(10);
    expect(store.nonBuveurs()).toBe(2);
  });

  it('fusionne la consommation de tout le monde dans un seul panier', () => {
    const panier = store.panier();

    // 6 x 5 bieres + 4 x 3 spritz + 2 x 3 jus = 30 + 12 + 6.
    expect(panier.verresTotal).toBe(48);
    expect(panier.verresAlcoolises).toBe(42);
    expect(panier.lignes.some((x) => x.produit.id === 'aperol')).toBe(true);
  });

  it('multiplie par le nombre de jours', () => {
    const avant = store.panier().verresTotal;
    store.majPartage({ jours: 3 });

    expect(store.panier().verresTotal).toBe(avant * 3);
  });

  it("n'edite que les effectifs de l'onglet ouvert", () => {
    store.onglet.set('m');
    store.majEffectif('p2', 10);

    expect(store.participants().find((x) => x.id === 'm')?.effectifs).toEqual([
      { personneTypeId: 'p2', nombre: 10 },
    ]);
    expect(store.participants().find((x) => x.id === 'a')?.effectifs).toHaveLength(2);
  });

  it('retire un effectif tombe a zero', () => {
    store.onglet.set('a');
    store.majEffectif('p3', 0);

    expect(store.effectifs().some((x) => x.personneTypeId === 'p3')).toBe(false);
    expect(store.cadre().invites).toBe(10);
  });

  it('partage la bibliotheque de profils entre co-organisateurs', () => {
    store.onglet.set('a');
    // Marie a cree la team spritz ; Antoine peut la compter dans ses invites.
    store.majEffectif('p2', 3);

    expect(store.invitesDuParticipant()).toBe(11);
    expect(store.resumePersonnesTypes().find((x) => x.personneType.id === 'p2')?.effectif).toBe(7);
  });

  it('cree un profil signe par celui qui le cree', () => {
    const id = store.creerPersonneType();
    const cree = store.personnesTypes().find((x) => x.id === id);

    expect(cree?.creeParNom).toBe('Antoine');
    expect(cree?.consommation).toHaveLength(0);
  });

  it("duplique un profil pour le retoucher sans casser l'original", () => {
    const id = store.dupliquerPersonneType('p1');
    const copie = store.personnesTypes().find((x) => x.id === id);

    expect(copie?.nom).toBe('Le buveur de biere (copie)');
    expect(copie?.consommation).toEqual(BUVEUR_BIERE.consommation);
    store.majConsommation(id, 'biere', 1);
    expect(store.personnesTypes().find((x) => x.id === 'p1')?.consommation[0].verresParJour).toBe(
      5,
    );
  });

  it('regle et retire une boisson dans un profil', () => {
    store.majConsommation('p1', 'whisky-coca', 2);
    expect(store.personnesTypes().find((x) => x.id === 'p1')?.consommation).toHaveLength(2);

    store.majConsommation('p1', 'whisky-coca', 0);
    expect(store.personnesTypes().find((x) => x.id === 'p1')?.consommation).toHaveLength(1);
  });

  it('supprime un profil et les effectifs qui le visaient', () => {
    store.supprimerPersonneType('p1');

    expect(store.personnesTypes().some((x) => x.id === 'p1')).toBe(false);
    expect(store.participants().find((x) => x.id === 'a')?.effectifs).toEqual([
      { personneTypeId: 'p3', nombre: 2 },
    ]);
    expect(store.cadre().invites).toBe(6);
  });

  it('repartit le cout au prorata du volume consomme', () => {
    const repartition = store.repartition();

    expect(repartition).toHaveLength(2);
    expect(repartition[0].part + repartition[1].part).toBeCloseTo(100);
    expect(repartition[0].montant + repartition[1].montant).toBeCloseTo(store.panier().coutTotal);
    expect(repartition[0].invites).toBe(8);
  });

  it('ne montre aucun effectif sur la vue totale', () => {
    store.onglet.set(ONGLET_EVENEMENT);
    expect(store.effectifs()).toHaveLength(0);
    expect(store.participantEdite()).toBeUndefined();
  });

  it('retombe sur la vue totale si le participant affiche disparait', () => {
    store.onglet.set('m');
    api.evenement.participants = [participant('a', 'Antoine', [['p1', 6]])];
    store['appliquer'](api.evenement);

    expect(store.onglet()).toBe(ONGLET_EVENEMENT);
  });
});
