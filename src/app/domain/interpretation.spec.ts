import { describe, expect, it } from 'vitest';
import {
  aDeclareQuelqueChose,
  alerterSurEstimation,
  estimerConsommation,
  interpreter,
  scorerProfil,
} from './interpretation';
import { inviteVierge } from './invites';
import { Invite, PersonneType } from './models';

function fiche(patch: Partial<Invite>): Invite {
  return { ...inviteVierge('i1', 'a'), prenom: 'Paul', ...patch };
}

function profil(id: string, consommation: [string, number][]): PersonneType {
  return {
    id,
    nom: id,
    description: '',
    emoji: '🍺',
    creeParNom: 'Antoine',
    consommation: consommation.map(([boissonId, verresParJour]) => ({ boissonId, verresParJour })),
  };
}

describe('estimation de consommation', () => {
  it('ne rend rien pour une fiche qui n’a rien declare', () => {
    expect(aDeclareQuelqueChose(fiche({}))).toBe(false);
    expect(estimerConsommation(fiche({}))).toEqual([]);
  });

  it('traduit un gout unique en verres par jour', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'croisiere',
        niveaux: { biere: 'moyen', vin: 'aucun', spiritueux: 'aucun' },
        boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
      }),
    );
    // « Moyen » vaut 4 verres, et la biere est seule a les porter.
    expect(estimation).toEqual([{ boissonId: 'biere', verresParJour: 4 }]);
  });

  it('repartit au prorata de l’intensite du gout', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'bateau-ivre',
        niveaux: { biere: 'aucun', vin: 'moyen', spiritueux: 'aucun' },
        boissonsAimees: [
          { boissonId: 'vin-rouge', intensite: 3 },
          { boissonId: 'vin-blanc', intensite: 1 },
        ],
      }),
    );
    const rouge = estimation.find((x) => x.boissonId === 'vin-rouge');
    const blanc = estimation.find((x) => x.boissonId === 'vin-blanc');
    // Les 4 verres de la famille « vin » se partagent 3/1 entre les deux.
    expect(rouge?.verresParJour).toBe(3);
    expect(blanc?.verresParJour).toBe(1);
  });

  it('le chameau ne boit rien, quoi qu’il ait coche', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'chameau',
        niveaux: { biere: 'beaucoup', vin: 'aucun', spiritueux: 'aucun' },
        boissonsAimees: [{ boissonId: 'biere', intensite: 4 }],
      }),
    );
    expect(estimation).toEqual([]);
  });

  it('rabat l’estimation sur le plafond de l’equipe', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'degustation',
        niveaux: { biere: 'abuse', vin: 'aucun', spiritueux: 'aucun' },
        boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
      }),
    );
    const total = estimation.reduce((somme, x) => somme + x.verresParJour, 0);
    // « Abuse » vaut 11 verres, mais la team degustation plafonne a 3.
    expect(total).toBeLessThanOrEqual(3);
  });

  it('ignore les gouts absents du catalogue, sans perdre les autres', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'croisiere',
        niveaux: { biere: 'moyen', vin: 'aucun', spiritueux: 'moyen' },
        boissonsAimees: [
          { boissonId: 'biere', intensite: 2 },
          { boissonId: 'tequila', intensite: 2 },
        ],
      }),
    );
    // La tequila n'existe pas au catalogue : son budget spiritueux ne part
    // nulle part, et surtout il ne se deverse pas sur la biere.
    expect(estimation).toEqual([{ boissonId: 'biere', verresParJour: 4 }]);
  });
});

describe('garde-fous', () => {
  it('signale le chameau qui coche des alcools', () => {
    const invite = fiche({
      team: 'chameau',
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => x.gravite === 'attention' && /sans alcool/i.test(x.texte))).toBe(
      true,
    );
  });

  it('signale une estimation trop haute', () => {
    const invite = fiche({
      team: 'bateau-ivre',
      niveaux: { biere: 'abuse', vin: 'abuse', spiritueux: 'abuse' },
      boissonsAimees: [
        { boissonId: 'biere', intensite: 4 },
        { boissonId: 'vin-rouge', intensite: 4 },
        { boissonId: 'whisky', intensite: 4 },
      ],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => x.gravite === 'attention' && /haute/i.test(x.texte))).toBe(true);
  });

  it('signale le rythme declare qui depasse le plafond de l’equipe', () => {
    const invite = fiche({
      team: 'degustation',
      niveaux: { biere: 'abuse', vin: 'aucun', spiritueux: 'aucun' },
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => /plafond/i.test(x.texte))).toBe(true);
  });

  it('remonte l’alcool ecrit en clair, absent de la liste', () => {
    const invite = fiche({
      team: 'croisiere',
      niveaux: { biere: 'moyen', vin: 'aucun', spiritueux: 'aucun' },
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
      autreAlcool: 'Limoncello',
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => /Limoncello/.test(x.texte))).toBe(true);
  });

  it('signale un gout qu’on ne sait pas servir', () => {
    const invite = fiche({
      team: 'croisiere',
      niveaux: { biere: 'aucun', vin: 'aucun', spiritueux: 'moyen' },
      boissonsAimees: [{ boissonId: 'tequila', intensite: 4 }],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => /catalogue/i.test(x.texte))).toBe(true);
  });
});

describe('correspondance avec les profils', () => {
  it('donne 100 a un profil identique et moins a un profil eloigne', () => {
    const estimation = [{ boissonId: 'biere', verresParJour: 4 }];
    expect(scorerProfil(estimation, profil('exact', [['biere', 4]]))).toBe(100);
    expect(scorerProfil(estimation, profil('autre', [['vin-rouge', 4]]))).toBe(0);
    expect(scorerProfil(estimation, profil('proche', [['biere', 3]]))).toBeGreaterThan(70);
  });

  it('propose le meilleur profil quand il colle assez', () => {
    const invite = fiche({
      team: 'croisiere',
      niveaux: { biere: 'moyen', vin: 'aucun', spiritueux: 'aucun' },
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
    });
    const resultat = interpreter(invite, [
      profil('buveur-biere', [['biere', 4]]),
      profil('team-vin', [['vin-rouge', 5]]),
    ]);

    expect(resultat.verresParJour).toBe(4);
    expect(resultat.meilleur?.personneType.id).toBe('buveur-biere');
    expect(resultat.meilleur?.score).toBe(100);
    // Les correspondances sont triees, la meilleure en tete.
    expect(resultat.correspondances[0].score).toBeGreaterThanOrEqual(
      resultat.correspondances[1].score,
    );
  });

  it('ne propose rien quand aucun profil ne ressemble', () => {
    const invite = fiche({
      team: 'croisiere',
      niveaux: { biere: 'moyen', vin: 'aucun', spiritueux: 'aucun' },
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
    });
    const resultat = interpreter(invite, [profil('team-vin', [['vin-rouge', 5]])]);
    expect(resultat.meilleur).toBeUndefined();
  });
});
