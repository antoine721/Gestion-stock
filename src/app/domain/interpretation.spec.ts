import { describe, expect, it } from 'vitest';
import { alerterSurEstimation, estimerConsommation, interpreter } from './interpretation';
import { inviteVierge } from './invites';
import { Invite } from './models';

function fiche(patch: Partial<Invite>): Invite {
  return { ...inviteVierge('i1', 'a'), prenom: 'Paul', ...patch };
}

/** Le nombre de verres declare, famille par famille. */
function verres(biere = 0, vin = 0, spiritueux = 0) {
  return { biere, vin, spiritueux };
}

describe('estimation de consommation', () => {
  it('ne rend rien pour une fiche qui n’a rien declare', () => {
    expect(estimerConsommation(fiche({}))).toEqual([]);
  });

  it('traduit un gout unique en verres par jour', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'croisiere',
        verresParFamille: verres(4),
        boissonsAimees: [{ boissonId: 'biere', intensite: 100 }],
      }),
    );
    // Quatre verres declares, une seule boisson pour les porter.
    expect(estimation).toEqual([{ boissonId: 'biere', verresParJour: 4 }]);
  });

  it('repartit au prorata des parts declarees', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'bateau-ivre',
        verresParFamille: verres(0, 4),
        boissonsAimees: [
          { boissonId: 'vin-rouge', intensite: 75 },
          { boissonId: 'vin-blanc', intensite: 25 },
        ],
      }),
    );

    expect(estimation.find((x) => x.boissonId === 'vin-rouge')?.verresParJour).toBe(3);
    expect(estimation.find((x) => x.boissonId === 'vin-blanc')?.verresParJour).toBe(1);
  });

  it('rend exactement les verres declares, meme en quarts', () => {
    // Un verre partage en trois ne tombe pas juste : les quarts perdus par
    // l'arrondi vont aux plus gros restes, et le total reste a 1.
    const estimation = estimerConsommation(
      fiche({
        team: 'croisiere',
        verresParFamille: verres(0, 0, 1),
        boissonsAimees: [
          { boissonId: 'rhum', intensite: 40 },
          { boissonId: 'vodka', intensite: 30 },
          { boissonId: 'gin', intensite: 30 },
        ],
      }),
    );

    expect(estimation.reduce((somme, x) => somme + x.verresParJour, 0)).toBe(1);
    expect(estimation.every((x) => (x.verresParJour * 4) % 1 === 0)).toBe(true);
  });

  it('ne rabat plus rien sur le plafond de l’equipe', () => {
    // Le nombre est declare, pas devine : on le respecte et on alerte.
    const invite = fiche({
      team: 'degustation',
      verresParFamille: verres(8),
      boissonsAimees: [{ boissonId: 'biere', intensite: 100 }],
    });

    expect(estimerConsommation(invite)).toEqual([{ boissonId: 'biere', verresParJour: 8 }]);
    expect(
      alerterSurEstimation(invite, estimerConsommation(invite)).some((x) =>
        /equipe/i.test(x.texte),
      ),
    ).toBe(true);
  });

  it('le chameau ne boit rien, quoi qu’il ait coche', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'chameau',
        verresParFamille: verres(6),
        boissonsAimees: [{ boissonId: 'biere', intensite: 100 }],
      }),
    );
    expect(estimation).toEqual([]);
  });

  it('des verres declares sans aucun gout ne s’inventent pas une boisson', () => {
    const estimation = estimerConsommation(
      fiche({ team: 'croisiere', verresParFamille: verres(0, 0, 4), boissonsAimees: [] }),
    );
    expect(estimation).toEqual([]);
  });

  it('ignore un gout absent du catalogue, sans perdre les autres', () => {
    const estimation = estimerConsommation(
      fiche({
        team: 'croisiere',
        verresParFamille: verres(4, 0, 4),
        boissonsAimees: [
          { boissonId: 'biere', intensite: 100 },
          { boissonId: 'cidre', intensite: 100 },
        ],
      }),
    );
    // Le cidre n'existe pas au catalogue : son budget ne part nulle part, et
    // surtout il ne se deverse pas sur la biere.
    expect(estimation).toEqual([{ boissonId: 'biere', verresParJour: 4 }]);
  });
});

describe('garde-fous', () => {
  it('signale le chameau qui coche des alcools', () => {
    const invite = fiche({
      team: 'chameau',
      boissonsAimees: [{ boissonId: 'biere', intensite: 100 }],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => x.gravite === 'attention' && /sans alcool/i.test(x.texte))).toBe(
      true,
    );
  });

  it('signale une estimation trop haute', () => {
    const invite = fiche({
      team: 'bateau-ivre',
      verresParFamille: verres(8, 4, 4),
      boissonsAimees: [
        { boissonId: 'biere', intensite: 100 },
        { boissonId: 'vin-rouge', intensite: 100 },
        { boissonId: 'whisky', intensite: 100 },
      ],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => x.gravite === 'attention' && /haute/i.test(x.texte))).toBe(true);
  });

  it('remonte l’alcool ecrit en clair, absent de la liste', () => {
    const invite = fiche({
      team: 'croisiere',
      verresParFamille: verres(3),
      boissonsAimees: [{ boissonId: 'biere', intensite: 100 }],
      autreAlcool: 'Limoncello',
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => /Limoncello/.test(x.texte))).toBe(true);
  });

  it('signale un gout qu’on ne sait pas servir', () => {
    const invite = fiche({
      team: 'croisiere',
      verresParFamille: verres(0, 0, 3),
      boissonsAimees: [{ boissonId: 'cidre', intensite: 100 }],
    });
    const alertes = alerterSurEstimation(invite, estimerConsommation(invite));
    expect(alertes.some((x) => /catalogue/i.test(x.texte))).toBe(true);
  });
});

describe('interpreter', () => {
  it('rend la consommation, son total et les alertes', () => {
    const resultat = interpreter(
      fiche({
        team: 'croisiere',
        verresParFamille: verres(2, 2),
        boissonsAimees: [
          { boissonId: 'biere', intensite: 100 },
          { boissonId: 'vin-rouge', intensite: 100 },
        ],
      }),
    );

    expect(resultat.verresParJour).toBe(4);
    expect(resultat.consommation).toHaveLength(2);
  });
});
