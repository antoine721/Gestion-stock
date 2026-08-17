import { TestBed } from '@angular/core/testing';
import { PARTAGE_INITIAL, PlannerStore } from './planner-store';
import { Api, EvenementDistant } from './api';
import { logistiqueVierge } from '../domain/invites';
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

  it('compte un invite nomme avec profil comme une tete qui boit', () => {
    const id = store.ajouterInvite('a');
    store.majInvite(id, { prenom: 'Paul', personneTypeId: 'p2' });

    expect(store.cadre().invites).toBe(13);
    // 4 anonymes de Marie + le Paul d'Antoine.
    expect(store.resumePersonnesTypes().find((x) => x.personneType.id === 'p2')?.effectif).toBe(5);
  });

  it('vide les effectifs anonymes herites de l’ancienne saisie', () => {
    expect(store.effectifsAnonymes()).toBe(12);
    store.viderEffectifsAnonymes();

    expect(store.effectifsAnonymes()).toBe(0);
    expect(store.cadre().invites).toBe(0);
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

  it('supprime un profil, les effectifs et les rattachements qui le visaient', () => {
    const invite = store.ajouterInvite('a');
    store.majInvite(invite, { personneTypeId: 'p1' });
    store.supprimerPersonneType('p1');

    expect(store.personnesTypes().some((x) => x.id === 'p1')).toBe(false);
    expect(store.participants().find((x) => x.id === 'a')?.effectifs).toEqual([
      { personneTypeId: 'p3', nombre: 2 },
    ]);
    expect(store.invitesNommes().find((x) => x.id === invite)?.personneTypeId).toBe('');
  });

  it('repartit le cout au prorata du volume consomme', () => {
    const repartition = store.repartition();

    expect(repartition).toHaveLength(2);
    expect(repartition[0].part + repartition[1].part).toBeCloseTo(100);
    expect(repartition[0].montant + repartition[1].montant).toBeCloseTo(store.panier().coutTotal);
    expect(repartition[0].invites).toBe(8);
  });

  it('suit les encaissements des invites', () => {
    const categorie = store.ajouterCategoriePaiement();
    store.majCategoriePaiement(categorie, { nom: 'Week-end complet', montant: 40 });
    const invite = store.ajouterInvite('a');
    store.majInvite(invite, { prenom: 'Paul', categoriePaiementId: categorie });

    expect(store.encaissements().attendu).toBe(40);
    expect(store.encaissements().enAttente).toBe(1);

    store.majInvite(invite, { paye: true, montantPaye: 40 });
    expect(store.encaissements().encaisse).toBe(40);
    expect(store.encaissements().reste).toBe(0);
  });

  it('agrege la cuisine et la verse dans la liste de courses unifiee', () => {
    store.appliquerIdee(1, 'diner', 'Barbecue');

    const viande = store.lignesCuisine().find((x) => x.nom === 'Viande a griller');
    // 12 tetes x 180 g, agreges avant l'arrondi au kilo.
    expect(viande?.besoin).toBe(2160);
    expect(viande?.quantiteAchat).toBe(3);

    const ligne = store.listeCourses().find((x) => x.groupe === 'cuisine');
    expect(ligne).toBeDefined();
    store.basculerCourse(ligne!.id);
    expect(store.listeCourses().find((x) => x.id === ligne!.id)?.cochee).toBe(true);
  });

  it('valider une reponse du formulaire en fait une fiche, conso comprise', () => {
    store.majPartage({
      reponsesFormulaire: [
        {
          id: 'f1',
          prenom: 'Chloe',
          nom: 'Petit',
          invitePar: 'Antoine',
          accompagnants: 0,
          regime: 'vegan',
          allergies: 'arachide',
          preferencesBoissons: '',
          envies: 'karaoke',
          recommandations: '',
          commentaire: '',
          consommations: [{ boissonId: 'biere', verresParJour: 3 }],
          stylesMusicaux: 'techno',
          logistique: { ...logistiqueVierge(), vehicule: true, placesVoiture: 3 },
          surnom: 'Chlo',
          boissonsAimees: [{ boissonId: 'biere', intensite: 4 }],
          niveaux: { biere: 'moyen', vin: 'aucun', spiritueux: 'aucun' },
          autreAlcool: 'Limoncello',
          team: 'croisiere',
          servicesPreferes: ['cuisine'],
          creeLe: '2026-08-10T10:00:00.000Z',
        },
      ],
    });

    store.importerReponse('f1', 'a');

    const fiche = store.invitesNommes().find((x) => x.prenom === 'Chloe');
    expect(fiche?.participantId).toBe('a');
    expect(fiche?.regime).toBe('vegan');
    // La conso suit la fiche, mais ne cree AUCUN profil : le calcul ne bouge
    // pas tant que l'organisateur n'a pas attache un profil.
    expect(fiche?.consommationDeclaree).toEqual([{ boissonId: 'biere', verresParJour: 3 }]);
    expect(fiche?.personneTypeId).toBe('');
    expect(fiche?.stylesMusicaux).toBe('techno');
    expect(fiche?.logistique.placesVoiture).toBe(3);
    expect(store.reponsesFormulaire()).toHaveLength(0);
    // 3 places offertes, personne ne cherche : la synthese suit.
    expect(store.resumeLogistique().placesOffertes).toBe(3);
  });

  it('assigne et retire des missions sur un creneau', () => {
    const creneauId = store.ajouterCreneau(1);
    const inviteId = store.ajouterInvite('a');

    store.assignerPersonne(creneauId, `inv:${inviteId}`);
    store.assignerPersonne(creneauId, 'org:m');
    // Une deuxieme assignation identique ne double pas l'equipe.
    store.assignerPersonne(creneauId, 'org:m');

    const creneau = store.programme().creneaux.find((x) => x.id === creneauId);
    expect(creneau?.assignes).toEqual([`inv:${inviteId}`, 'org:m']);
    expect(store.resumeProgramme().sansAssigne).toBe(0);

    store.retirerAssignation(creneauId, 'org:m');
    expect(store.programme().creneaux.find((x) => x.id === creneauId)?.assignes).toEqual([
      `inv:${inviteId}`,
    ]);
  });

  it('suit le workflow des sets DJ', () => {
    const setId = store.ajouterDjSet({ jour: 1, debut: '21:00', dj: 'org:a' });
    expect(store.resumeDj().demandes).toBe(1);

    store.majDjSet(setId, { statut: 'valide' });
    expect(store.resumeDj().demandes).toBe(0);
    expect(store.resumeDj().valides).toBe(1);

    store.supprimerDjSet(setId);
    expect(store.resumeDj().total).toBe(0);
  });

  it('le bouton retour rejoue la navigation entre espaces', () => {
    store.allerA('programme');
    store.allerA('dj');
    expect(store.peutRevenir()).toBe(true);

    store.retour();
    expect(store.espace()).toBe('programme');
    store.retour();
    expect(store.espace()).toBe('accueil');
    expect(store.peutRevenir()).toBe(false);
  });

  it('genere puis retire un jeu de test sans toucher aux vraies fiches', () => {
    const vrai = store.ajouterInvite('a');

    // 10 fiches par co-organisateur, et il y en a deux dans cet evenement.
    expect(store.peuplerJeuTest(10)).toBe(20);
    expect(store.invitesNommes()).toHaveLength(21);
    expect(store.invitesTest()).toBe(20);
    // Regenerer remplace le jeu au lieu de l'empiler.
    store.peuplerJeuTest(10);
    expect(store.invitesNommes()).toHaveLength(21);

    store.viderJeuTest();
    expect(store.invitesNommes().map((x) => x.id)).toEqual([vrai]);
  });

  it('cocher une ligne materiel bascule le statut de l’article', () => {
    const id = store.ajouterArticle({ nom: 'Guirlandes' });
    store.basculerCourse(`materiel:${id}`);

    expect(store.articles().find((x) => x.id === id)?.statut).toBe('achete');
    store.basculerCourse(`materiel:${id}`);
    expect(store.articles().find((x) => x.id === id)?.statut).toBe('a-prevoir');
  });
});
