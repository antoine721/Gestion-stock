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
        niveauBasiques: 'moyen',
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
        niveauBasiques: 'moyen',
        boissonsAimees: [
          { boissonId: 'biere', intensite: 3 },
          { boissonId: 'vin-rouge', intensite: 1 },
        ],
      }),
    );
    const biere = estimation.find((x) => x.boissonId === 'biere');
    const vin = estimation.find((x) => x.boissonId === 'vin-rouge');
    // 4 verres partages 3/1 : la biere en prend trois fois plus.
    expect(biere?.verresParJour).toBe(3);
    expect(vin?.verresParJour).toBe(1);
  });

  it('le chameau ne boit rien, quoi qu’il ait coche', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'chameau',
        niveauBasiques: 'beaucoup',
        boissonsAimees: [{ boissonId: 'biere', intensite: 5 }],
      }),
    );
    expect(estimation).toEqual([]);
  });

  it('rabat l’estimation sur le plafond de l’equipe', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'degustation',
        niveauBasiques: 'abuse',
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
        niveauBasiques: 'moyen',
        boissonsAimees: [
          { boissonId: 'biere', intensite: 2 },
          { boissonId: 'cidre', intensite: 2 },
        ],
      }),
    );
    // Le cidre n'existe pas au catalogue : ses verres reviennent a la biere.
    expect(estimation).toEqual([{ boissonId: 'biere', verresParJour: 4 }]);
  });
});

describe('garde-fous', () => {
  it('signale le chameau qui coche des alcools', () => {
    const invite = fiche({
      team: 'chameau',
      boissonsAimees: [{ boissonId: 'biere', intensite: 4 }],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => x.gravite === 'attention' && /sans alcool/i.test(x.texte))).toBe(
      true,
    );
  });

  it('signale une estimation trop haute', () => {
    const invite = fiche({
      team: 'bateau-ivre',
      niveauBasiques: 'abuse',
      niveauSpiritueux: 'abuse',
      boissonsAimees: [
        { boissonId: 'biere', intensite: 5 },
        { boissonId: 'whisky', intensite: 5 },
      ],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => x.gravite === 'attention' && /haute/i.test(x.texte))).toBe(true);
  });

  it('signale le rythme declare qui depasse le plafond de l’equipe', () => {
    const invite = fiche({
      team: 'degustation',
      niveauBasiques: 'abuse',
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => /plafond/i.test(x.texte))).toBe(true);
  });

  it('signale un gout qu’on ne sait pas servir', () => {
    const invite = fiche({
      team: 'croisiere',
      niveauSpiritueux: 'moyen',
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
      niveauBasiques: 'moyen',
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
      niveauBasiques: 'moyen',
      boissonsAimees: [{ boissonId: 'biere', intensite: 3 }],
    });
    const resultat = interpreter(invite, [profil('team-vin', [['vin-rouge', 5]])]);
    expect(resultat.meilleur).toBeUndefined();
  });
});
