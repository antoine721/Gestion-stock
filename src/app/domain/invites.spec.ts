import { describe, expect, it } from 'vitest';
import {
  compterParRegime,
  effectifsAvecInvites,
  fusionnerEffectifs,
  inviteVierge,
  invitesAvecAllergies,
  invitesNommesDe,
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
});
