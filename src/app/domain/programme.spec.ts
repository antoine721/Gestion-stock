import { describe, expect, it } from 'vitest';
import {
  creneauVierge,
  demandesMusicales,
  planningDuJour,
  resumerProgramme,
  volontaires,
} from './programme';
import { inviteVierge } from './invites';
import { Creneau, Programme } from './models';

function creneau(id: string, jour: number, debut: string): Creneau {
  return { ...creneauVierge(id, jour), debut, titre: id };
}

describe('planning', () => {
  const programme: Programme = {
    creneaux: [
      creneau('petanque', 1, '15:00'),
      creneau('apero', 1, '11:30'),
      creneau('sans-heure', 1, ''),
      creneau('brunch', 2, '10:00'),
    ],
    tracklist: [],
  };

  it('trie les creneaux du jour, les sans-heure a la fin', () => {
    const jour1 = planningDuJour(programme, 1);
    expect(jour1.map((x) => x.titre)).toEqual(['apero', 'petanque', 'sans-heure']);
  });

  it('resume le programme et repere les jours vides', () => {
    const resume = resumerProgramme(programme, 3);
    expect(resume.creneaux).toBe(4);
    // Le jour 3 n'a rien : le programme a un trou.
    expect(resume.joursVides).toBe(1);
  });
});

describe('musique', () => {
  const reponse = {
    id: 'f1',
    prenom: 'Chloe',
    nom: '',
    invitePar: '',
    accompagnants: 0,
    regime: 'omnivore' as const,
    allergies: '',
    preferencesBoissons: '',
    envies: '',
    recommandations: 'Daft Punk',
    commentaire: '',
    creeLe: '',
  };

  it('propose les demandes du formulaire et des fiches qui parlent musique', () => {
    const invites = [
      { ...inviteVierge('i1', 'a'), prenom: 'Paul', remarques: 'playlist rock : ACDC' },
      { ...inviteVierge('i2', 'a'), prenom: 'Lucie', remarques: 'arrive samedi' },
    ];
    const demandes = demandesMusicales([reponse], invites, []);

    expect(demandes.map((x) => x.demandePar)).toEqual(['Chloe', 'Paul']);
  });

  it('ne repropose pas une demande deja dans la tracklist', () => {
    const demandes = demandesMusicales(
      [reponse],
      [],
      [{ id: 'm1', titre: 'Daft Punk', artiste: '', demandePar: 'Chloe' }],
    );
    expect(demandes).toHaveLength(0);
  });

  it('liste les volontaires depuis les envies des fiches', () => {
    const invites = [
      { ...inviteVierge('i1', 'a'), prenom: 'Paul', envies: 'DJ' },
      { ...inviteVierge('i2', 'a'), prenom: 'Lucie' },
    ];
    expect(volontaires(invites).map((x) => x.prenom)).toEqual(['Paul']);
  });
});
