import { describe, expect, it } from 'vitest';
import {
  TACHES_INVITE,
  calculerEncaissements,
  compterParRegime,
  effectifsAvecInvites,
  fusionnerEffectifs,
  inviteVierge,
  invitesAvecAllergies,
  invitesNommesDe,
  neBoitPas,
  normaliserInvite,
  presenceComplete,
  etatTaches,
  tousLesJours,
} from './invites';
import { Invite } from './models';

function invite(id: string, options: Partial<Invite> = {}): Invite {
  return { ...inviteVierge(id, 'antoine'), prenom: id, ...options };
}

describe('invites nommes', () => {
  it('filtre les invites d’un co-organisateur', () => {
    const liste = [invite('a'), invite('b', { participantId: 'marie' })];
    expect(invitesNommesDe(liste, 'antoine')).toHaveLength(1);
    expect(invitesNommesDe(liste, 'marie')[0].prenom).toBe('b');
  });

  it('ajoute une tete par invite nomme au profil attache', () => {
    const effectifs = [{ personneTypeId: 'biere', nombre: 3 }];
    const fusion = fusionnerEffectifs(effectifs, [
      invite('a', { personneTypeId: 'biere' }),
      invite('b', { personneTypeId: 'spritz' }),
    ]);

    expect(fusion.find((x) => x.personneTypeId === 'biere')?.nombre).toBe(4);
    expect(fusion.find((x) => x.personneTypeId === 'spritz')?.nombre).toBe(1);
  });

  it('ignore les invites sans profil dans la fusion des boissons', () => {
    const fusion = fusionnerEffectifs([], [invite('a')]);
    expect(fusion).toHaveLength(0);
  });

  it('compte quand meme les invites sans profil comme des tetes', () => {
    const effectifs = effectifsAvecInvites([], [invite('a'), invite('b')]);
    const total = effectifs.reduce((somme, x) => somme + x.nombre, 0);
    expect(total).toBe(2);
    // Le profil vide n'existe pas : le moteur de boissons l'ignorera.
    expect(effectifs[0].personneTypeId).toBe('');
  });

  it('compte les regimes pour dimensionner les plats', () => {
    const comptes = compterParRegime([
      invite('a', { regime: 'vegetarien' }),
      invite('b', { regime: 'vegetarien' }),
      invite('c', { regime: 'vegan' }),
    ]);

    expect(comptes.find((x) => x.regime === 'vegetarien')?.nombre).toBe(2);
    expect(comptes.find((x) => x.regime === 'vegan')?.nombre).toBe(1);
    expect(comptes.find((x) => x.regime === 'omnivore')).toBeUndefined();
  });

  it('liste les allergies a avoir en cuisine', () => {
    const liste = [invite('a', { allergies: 'arachide' }), invite('b', { allergies: '  ' })];
    expect(invitesAvecAllergies(liste)).toHaveLength(1);
  });

  it('normalise un invite d’avant le suivi de paiement', () => {
    const ancien = { id: 'x', prenom: 'Paul', participantId: 'antoine' };
    const normalise = normaliserInvite(ancien);

    expect(normalise.paye).toBe(false);
    expect(normalise.montantPaye).toBe(0);
    expect(normalise.categoriePaiementId).toBe('');
    expect(normalise.joursPresents).toEqual([]);
    expect(normalise.goodies).toEqual([]);
    expect(normalise.logistique.tente).toBe(false);
    expect(normalise.prenom).toBe('Paul');
  });
});

describe('jours sur place', () => {
  it('ne perd pas le nombre de jours des fiches d’avant', () => {
    // Ces fiches ne portaient qu'un compte. Le jeter afficherait « — » sur
    // des invites dont on savait qu'ils restaient deux jours.
    const ancien = normaliserInvite({ id: 'x', participantId: 'a', joursPresence: 2 } as never);
    expect(ancien.joursPresents).toEqual([1, 2]);

    // Une fiche deja migree n'est pas retouchee.
    const migre = normaliserInvite({ id: 'y', participantId: 'a', joursPresents: [2, 3] } as never);
    expect(migre.joursPresents).toEqual([2, 3]);

    // Et « pas renseigne » reste « pas renseigne ».
    expect(normaliserInvite({ id: 'z', participantId: 'a' }).joursPresents).toEqual([]);
  });

  it('reconnait « tous les jours » quelle que soit la duree', () => {
    const complet = invite('a', { joursPresents: tousLesJours(3) });
    expect(presenceComplete(complet, 3)).toBe(true);
    // La meme fiche sur un evenement rallonge n'est plus complete.
    expect(presenceComplete(complet, 4)).toBe(false);
  });

  it('ne confond pas une presence partielle avec un sejour complet', () => {
    expect(presenceComplete(invite('a', { joursPresents: [2, 3] }), 3)).toBe(false);
  });
});

describe('taches d’une fiche', () => {
  const categories = [
    { id: 'we', nom: 'Week-end complet', montant: 40 },
    { id: 'gratuit', nom: 'Invite d’honneur', montant: 0 },
  ];

  it('compte les quatre cases a cocher', () => {
    const etat = etatTaches(invite('a'), categories);
    expect(etat.faites).toBe(0);

    const pret = invite('b', {
      categoriePaiementId: 'we',
      paye: true,
      personneTypeId: 'biere',
      joursPresents: [1, 2],
    });
    expect(etatTaches(pret, categories).faites).toBe(3);
  });

  it('n’attend aucun paiement sur un tarif gratuit', () => {
    const etat = etatTaches(invite('a', { categoriePaiementId: 'gratuit' }), categories);
    expect(etat.tarif).toBe(true);
    expect(etat.paiement).toBe(true);
  });

  it('ne demande plus de profil alcool : le formulaire s’en charge', () => {
    const chameau = invite('a', { team: 'chameau' });
    expect(neBoitPas(chameau)).toBe(true);
    // Trois taches, et aucune ne parle d'alcool.
    expect(TACHES_INVITE.map((x) => x.id)).toEqual(['tarif', 'paiement', 'presence']);
  });
});

describe('encaissements', () => {
  const categories = [
    { id: 'we', nom: 'Week-end complet', montant: 40 },
    { id: 'jour', nom: 'Une journee', montant: 15 },
  ];

  it('suit l’attendu, l’encaisse et ce qui manque', () => {
    const encaissements = calculerEncaissements(
      [
        invite('a', { categoriePaiementId: 'we', paye: true, montantPaye: 40 }),
        invite('b', { categoriePaiementId: 'we' }),
        invite('c', { categoriePaiementId: 'jour', paye: true, montantPaye: 10 }),
        // Sans categorie : rien d'attendu, rien a relancer.
        invite('d'),
      ],
      categories,
    );

    expect(encaissements.attendu).toBe(95);
    expect(encaissements.encaisse).toBe(50);
    expect(encaissements.reste).toBe(45);
    expect(encaissements.payes).toBe(2);
    expect(encaissements.enAttente).toBe(1);
  });
});

describe('les gouts des fiches d’avant', () => {
  it('deviennent des cases cochees', () => {
    const invite = normaliserInvite({
      id: 'i1',
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
    });
    expect(invite.boissonsAimees).toEqual([{ boissonId: 'biere', intensite: 100 }]);
  });
});
