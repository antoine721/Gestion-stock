import { describe, expect, it } from 'vitest';
import { EntreeCalendrier, construireCalendrier, enMinutes } from './calendrier';

function entree(id: string, jour: number, debut: string, fin = ''): EntreeCalendrier {
  return { id, jour, debut, fin };
}

describe('lecture des heures', () => {
  it('accepte les facons d’ecrire une heure', () => {
    expect(enMinutes('18:30')).toBe(18 * 60 + 30);
    expect(enMinutes('18h30')).toBe(18 * 60 + 30);
    expect(enMinutes(' 9:05 ')).toBe(9 * 60 + 5);
    expect(enMinutes('21')).toBe(21 * 60);
  });

  it('refuse ce qui n’est pas une heure', () => {
    expect(enMinutes('')).toBeNull();
    expect(enMinutes('apres le diner')).toBeNull();
    expect(enMinutes('25:00')).toBeNull();
    expect(enMinutes('18:75')).toBeNull();
  });
});

describe('grille du calendrier', () => {
  it('cadre la grille sur ce qui est reellement programme', () => {
    const grille = construireCalendrier([entree('a', 1, '14:00', '15:00')]);

    expect(grille.minuteDebut).toBe(14 * 60);
    // Une seule heure de programme : la grille s'ouvre a l'amplitude minimale.
    expect(grille.minuteFin).toBe(17 * 60);
    expect(grille.heures[0].libelle).toBe('14:00');
    expect(grille.heures[0].hautPct).toBe(0);
    expect(grille.heures.at(-1)?.hautPct).toBe(100);
  });

  it('place un bloc a sa hauteur, en pourcentage de la grille', () => {
    const grille = construireCalendrier([
      entree('matin', 1, '10:00', '11:00'),
      entree('soir', 1, '20:00', '22:00'),
    ]);

    // Grille 10 h -> 22 h, soit 12 h d'amplitude.
    const matin = grille.places.find((x) => x.id === 'matin');
    expect(matin?.hautPct).toBe(0);
    expect(matin?.hauteurPct).toBeCloseTo((60 / 720) * 100);

    const soir = grille.places.find((x) => x.id === 'soir');
    expect(soir?.hautPct).toBeCloseTo((600 / 720) * 100);
    expect(soir?.hauteurPct).toBeCloseTo((120 / 720) * 100);
  });

  it('donne une heure aux creneaux sans heure de fin', () => {
    const grille = construireCalendrier([entree('a', 1, '14:00')]);
    const place = grille.places[0];
    expect(place.hauteurPct).toBeCloseTo((60 / (grille.minuteFin - grille.minuteDebut)) * 100);
  });

  it('fait durer un set qui passe minuit, au lieu de le remonter', () => {
    const grille = construireCalendrier([entree('nuit', 1, '23:00', '01:00')]);

    // 23 h -> 1 h du matin : deux heures pleines, et la grille depasse minuit.
    expect(grille.minuteFin).toBe(26 * 60);
    expect(grille.places[0].hauteurPct).toBeCloseTo((120 / 180) * 100);
    // Les lignes de nuit se lisent « 00:00 », « 01:00 », pas « 24:00 ».
    expect(grille.heures.map((x) => x.libelle)).toEqual(['23:00', '00:00', '01:00', '02:00']);
  });

  it('partage la largeur entre les blocs qui se chevauchent', () => {
    const grille = construireCalendrier([
      entree('atelier', 1, '14:00', '16:00'),
      entree('tournoi', 1, '15:00', '17:00'),
      // Disjoint des deux premiers : il reprend toute la largeur.
      entree('diner', 1, '19:00', '20:00'),
    ]);

    const atelier = grille.places.find((x) => x.id === 'atelier');
    const tournoi = grille.places.find((x) => x.id === 'tournoi');
    expect(atelier?.colonnes).toBe(2);
    expect(tournoi?.colonnes).toBe(2);
    expect(atelier?.colonne).not.toBe(tournoi?.colonne);

    expect(grille.places.find((x) => x.id === 'diner')?.colonnes).toBe(1);
  });

  it('ne fait pas se chevaucher deux jours differents', () => {
    const grille = construireCalendrier([
      entree('j1', 1, '14:00', '16:00'),
      entree('j2', 2, '14:00', '16:00'),
    ]);

    expect(grille.places.every((x) => x.colonnes === 1)).toBe(true);
  });

  it('met de cote ce qui n’a pas d’heure', () => {
    const grille = construireCalendrier([
      entree('cale', 1, '14:00'),
      entree('a-caler', 1, ''),
      entree('flou', 1, 'apres le brunch'),
    ]);

    expect(grille.sansHeure).toEqual(['a-caler', 'flou']);
    expect(grille.places.map((x) => x.id)).toEqual(['cale']);
  });

  it('ouvre une fenetre par defaut quand rien n’est a l’heure', () => {
    const grille = construireCalendrier([entree('a', 1, '')]);

    expect(grille.minuteDebut).toBe(12 * 60);
    expect(grille.minuteFin).toBe(24 * 60);
    expect(grille.places).toHaveLength(0);
  });
});
