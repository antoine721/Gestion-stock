import { describe, expect, it } from 'vitest';
import { estInviteTest, genererInvitesTest } from './donnees-test';
import { CategoriePaiement, Participant, PersonneType } from './models';

const PARTICIPANTS: Participant[] = [
  { id: 'a', nom: 'Antoine', effectifs: [] },
  { id: 'm', nom: 'Marie', effectifs: [] },
  { id: 'k', nom: 'Karim', effectifs: [] },
];

const PROFILS: PersonneType[] = [
  {
    id: 'p1',
    nom: 'Le buveur de biere',
    description: '',
    emoji: '🍺',
    creeParNom: 'Antoine',
    consommation: [{ boissonId: 'biere', verresParJour: 5 }],
  },
  {
    id: 'p2',
    nom: 'La team spritz',
    description: '',
    emoji: '🍹',
    creeParNom: 'Marie',
    consommation: [{ boissonId: 'spritz', verresParJour: 3 }],
  },
];

const CATEGORIES: CategoriePaiement[] = [
  { id: 'c1', nom: 'Week-end complet', montant: 40 },
  { id: 'c2', nom: 'Une journee', montant: 15 },
];

describe('jeu de test', () => {
  const invites = genererInvitesTest(PARTICIPANTS, PROFILS, CATEGORIES, 2);

  it('genere 50 fiches marquees par co-organisateur', () => {
    expect(invites).toHaveLength(150);
    expect(invites.every(estInviteTest)).toBe(true);
    for (const participant of PARTICIPANTS) {
      expect(invites.filter((x) => x.participantId === participant.id)).toHaveLength(50);
    }
  });

  it('produit des fiches completes et coherentes', () => {
    expect(invites.every((x) => x.prenom.length > 0 && x.nom.length > 0)).toBe(true);
    // La grande majorite a sa categorie de buveur, piochee dans les profils.
    const avecProfil = invites.filter((x) => x.personneTypeId !== '');
    expect(avecProfil.length).toBeGreaterThan(invites.length * 0.75);
    expect(avecProfil.every((x) => PROFILS.some((p) => p.id === x.personneTypeId))).toBe(true);
    // La presence est toujours renseignee, et tient dans la duree.
    expect(invites.every((x) => x.joursPresents.length >= 1)).toBe(true);
    expect(invites.every((x) => x.joursPresents.every((j) => j >= 1 && j <= 2))).toBe(true);
    // Qui a verse de l'argent est marque paye, et sur une vraie categorie.
    const payeurs = invites.filter((x) => x.montantPaye > 0);
    expect(payeurs.length).toBeGreaterThan(0);
    expect(payeurs.every((x) => x.paye && x.categoriePaiementId !== '')).toBe(true);
    // Offrir des places suppose une voiture, et une voiture suppose le permis.
    expect(
      invites.every(
        (x) =>
          (x.logistique.placesVoiture === 0 || x.logistique.vehicule) &&
          (!x.logistique.vehicule || x.logistique.permis),
      ),
    ).toBe(true);
  });

  it('est deterministe : le meme jeu a chaque generation', () => {
    expect(genererInvitesTest(PARTICIPANTS, PROFILS, CATEGORIES, 2)).toEqual(invites);
  });
});
