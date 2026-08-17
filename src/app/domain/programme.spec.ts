import { describe, expect, it } from 'vitest';
import {
  creneauVierge,
  demandesMusicales,
  djSetVierge,
  nomDeRef,
  normaliserCreneau,
  personnesAssignables,
  planningDuJour,
  resumerDj,
  resumerProgramme,
  trierDjSets,
  volontaires,
} from './programme';
import { inviteVierge, logistiqueVierge } from './invites';
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

  it('resume le programme : jours vides et missions a pourvoir', () => {
    const resume = resumerProgramme(programme, 3);
    expect(resume.creneaux).toBe(4);
    // Le jour 3 n'a rien : le programme a un trou.
    expect(resume.joursVides).toBe(1);
    // Aucun creneau n'a d'equipe : tout est a pourvoir.
    expect(resume.sansAssigne).toBe(4);
  });

  it('normalise un creneau d’avant les missions', () => {
    const ancien = { id: 'x', jour: 2, titre: 'Apero' };
    expect(normaliserCreneau(ancien).assignes).toEqual([]);
  });
});

describe('missions', () => {
  it('assemble le vivier : co-organisateurs puis invites', () => {
    const personnes = personnesAssignables(
      [{ id: 'a', nom: 'Antoine', effectifs: [] }],
      [{ ...inviteVierge('i1', 'a'), prenom: 'Paul', nom: 'Durand' }],
    );

    expect(personnes.map((x) => x.ref)).toEqual(['org:a', 'inv:i1']);
    expect(nomDeRef('inv:i1', [], [{ ...inviteVierge('i1', 'a'), prenom: 'Paul' }])).toBe('Paul');
    // Une personne disparue ne designe plus rien.
    expect(nomDeRef('inv:disparu', [], [])).toBe('');
  });
});

describe('sets DJ', () => {
  it('trie par jour puis par heure, les sans-heure a la fin', () => {
    const sets = trierDjSets([
      { ...djSetVierge('c', 2), debut: '10:00' },
      { ...djSetVierge('b', 1), debut: '' },
      { ...djSetVierge('a', 1), debut: '21:00' },
    ]);
    expect(sets.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('resume le workflow : demandes et valides', () => {
    const resume = resumerDj([
      { ...djSetVierge('a', 1), statut: 'demande' },
      { ...djSetVierge('b', 1), statut: 'valide' },
      { ...djSetVierge('c', 1), statut: 'joue' },
      { ...djSetVierge('d', 1), statut: 'refuse' },
    ]);

    expect(resume.total).toBe(4);
    expect(resume.demandes).toBe(1);
    // Valide ou deja joue : le set est cale.
    expect(resume.valides).toBe(2);
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
    consommations: [],
    stylesMusicaux: '',
    logistique: logistiqueVierge(),
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
