import { describe, expect, it } from 'vitest';
import { dateDuJour, dureeEnJours, infosVierges, joursAvant } from './evenement';

describe('evenement', () => {
  const aujourdHui = new Date(2026, 7, 17); // 17 aout 2026

  it('compte les jours pleins avant le debut', () => {
    expect(joursAvant('2026-08-20', aujourdHui)).toBe(3);
    expect(joursAvant('2026-08-17', aujourdHui)).toBe(0);
    // Negatif une fois l'evenement commence.
    expect(joursAvant('2026-08-10', aujourdHui)).toBe(-7);
    expect(joursAvant('', aujourdHui)).toBeNull();
    expect(joursAvant('pas-une-date', aujourdHui)).toBeNull();
  });

  it('mesure la duree bornes comprises', () => {
    // Du vendredi au dimanche : trois jours de festival.
    expect(dureeEnJours('2026-08-21', '2026-08-23')).toBe(3);
    expect(dureeEnJours('2026-08-21', '2026-08-21')).toBe(1);
    // Une fin avant le debut ne veut rien dire.
    expect(dureeEnJours('2026-08-23', '2026-08-21')).toBeNull();
    expect(dureeEnJours('2026-08-21', '')).toBeNull();
  });

  it('date chaque jour du planning depuis le debut', () => {
    expect(dateDuJour('2026-08-21', 1)?.getDate()).toBe(21);
    expect(dateDuJour('2026-08-21', 2)?.getDate()).toBe(22);
    expect(dateDuJour('', 1)).toBeNull();
  });

  it('part d’une fiche vide, sans lieu ni dates', () => {
    expect(infosVierges()).toEqual({ lieu: '', debut: '', fin: '', description: '' });
  });
});
