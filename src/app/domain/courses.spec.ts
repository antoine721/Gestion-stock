import { describe, expect, it } from 'vitest';
import { listeCoursesUnifiee, resumerCourses } from './courses';
import { coursesCuisine } from './nourriture';
import { articleVierge } from './materiel-liste';
import { LigneAchat, Nourriture, Produit } from './models';

function produit(id: string): Produit {
  return {
    id,
    nom: id,
    categorie: 'biere',
    degre: 5,
    contenanceMl: 330,
    prixEur: 1.1,
    seConserve: false,
  };
}

function ligneBar(id: string, bouteilles: number): LigneAchat {
  return {
    produit: produit(id),
    mlNecessaire: 0,
    mlAvecMarge: 0,
    bouteilles,
    prixTotal: bouteilles * 1.1,
    resteMl: 0,
    plaisir: false,
    forfait: false,
    detail: [{ boissonNom: 'Biere', ml: 0 }],
  };
}

describe('liste de courses unifiee', () => {
  it('rassemble bar, cuisine, grignotage et materiel achete', () => {
    const cuisine = coursesCuisine(
      {
        repas: [
          {
            id: 'r1',
            jour: 1,
            moment: 'diner',
            typePlat: 'barbecue',
            plat: 'Barbecue',
            sansRepas: false,
            coutParPersonne: 0,
            convives: 0,
            vegetarienPrevu: false,
            notes: '',
            ingredients: [
              {
                id: 'i1',
                nom: 'Viande',
                qteParPersonne: 180,
                unite: 'g',
                prixUnitaire: 12,
              },
            ],
          },
        ],
        extras: [],
      },
      10,
      1,
    );

    const lignes = listeCoursesUnifiee(
      [ligneBar('biere', 12)],
      cuisine,
      [{ id: 'x1', nom: 'Chips', quantite: 4, prixUnitaire: 1.5 }],
      [
        { ...articleVierge('a1'), nom: 'Guirlandes', mode: 'achat', statut: 'achete' },
        { ...articleVierge('a2'), nom: 'Generateur', mode: 'location' },
      ],
      [
        {
          id: 'c1',
          nom: 'Papier toilette',
          marque: 'Lotus',
          code: '3255551234567',
          imageUrl: 'https://images.example/pq.jpg',
          categorie: 'intendance',
          quantite: 4,
          prixUnitaire: 2.5,
          achete: false,
        },
      ],
      new Set(['bar:biere']),
    );

    expect(lignes.map((x) => x.groupe)).toEqual([
      'bar',
      'cuisine',
      'grignotage',
      'rayon',
      'materiel',
    ]);
    // Chaque ligne repart avec son rayon : c'est lui qui separe le total.
    expect(lignes.find((x) => x.id === 'bar:biere')?.categorie).toBe('alcool');
    expect(lignes.find((x) => x.groupe === 'cuisine')?.categorie).toBe('nourriture');
    const pq = lignes.find((x) => x.id === 'rayon:c1');
    expect(pq?.categorie).toBe('intendance');
    expect(pq?.prix).toBe(10);
    expect(pq?.imageUrl).toBe('https://images.example/pq.jpg');
    // La location ne s'achete pas : elle n'a rien a faire dans les courses.
    expect(lignes.find((x) => x.nom === 'Generateur')).toBeUndefined();
    expect(lignes.find((x) => x.id === 'bar:biere')?.cochee).toBe(true);
    // Le statut du materiel fait foi, pas la liste des coches.
    expect(lignes.find((x) => x.id === 'materiel:a1')?.cochee).toBe(true);
  });

  it('resume le total et ce qui reste a acheter', () => {
    const resume = resumerCourses([
      {
        id: 'a',
        groupe: 'bar',
        categorie: 'alcool',
        nom: 'A',
        quantite: '',
        detail: '',
        prix: 30,
        cochee: true,
        imageUrl: '',
      },
      {
        id: 'b',
        groupe: 'cuisine',
        categorie: 'nourriture',
        nom: 'B',
        quantite: '',
        detail: '',
        prix: 20,
        cochee: false,
        imageUrl: '',
      },
    ]);

    expect(resume.total).toBe(50);
    expect(resume.restant).toBe(20);
    expect(resume.cochees).toBe(1);
  });
});

describe('courses cuisine (invariant grammes -> kilos entiers)', () => {
  const barbecue = (jour: number): Nourriture['repas'][number] => ({
    id: `r${jour}`,
    jour,
    moment: 'diner',
    typePlat: 'barbecue',
    plat: 'Barbecue',
    sansRepas: false,
    coutParPersonne: 0,
    convives: 0,
    vegetarienPrevu: false,
    notes: '',
    ingredients: [
      {
        id: `i${jour}`,
        nom: 'Viande',
        qteParPersonne: 180,
        unite: 'g',
        prixUnitaire: 12,
      },
    ],
  });

  it('agrege les repas AVANT d’arrondir au kilo', () => {
    const nourriture: Nourriture = { repas: [barbecue(1), barbecue(2)], extras: [] };
    const lignes = coursesCuisine(nourriture, 10, 2);

    expect(lignes).toHaveLength(1);
    // Deux barbecues, une seule ligne : 2 x 1800 g agreges avant conversion.
    expect(lignes[0].besoin).toBe(3600);
    // 3,6 kg au caddie, ca fait 4 kg : on ne compte pas les virgules.
    expect(lignes[0].quantiteAchat).toBe(4);
    expect(lignes[0].uniteAchat).toBe('kg');
    expect(lignes[0].prixTotal).toBe(48);
    expect(lignes[0].reste).toBe(400);
  });

  it('un besoin agrege economise un kilo par rapport au repas par repas', () => {
    const repas = [barbecue(1), barbecue(2)].map((x) => ({
      ...x,
      ingredients: x.ingredients.map((i) => ({ ...i, qteParPersonne: 140 })),
    }));
    const lignes = coursesCuisine({ repas, extras: [] }, 10, 2);

    // 2 x 1400 g = 2800 g -> 3 kg, la ou ceil(1,4) + ceil(1,4) = 4.
    expect(lignes[0].quantiteAchat).toBe(3);
  });

  it('achete les pieces a l’unite, sans les convertir', () => {
    const repas = [barbecue(1)].map((x) => ({
      ...x,
      ingredients: x.ingredients.map((i) => ({
        ...i,
        nom: 'Merguez',
        qteParPersonne: 1.5,
        unite: 'piece' as const,
        prixUnitaire: 0.65,
      })),
    }));
    const lignes = coursesCuisine({ repas, extras: [] }, 10, 1);

    // 15 merguez pile : la piece ne passe pas par le kilo.
    expect(lignes[0].quantiteAchat).toBe(15);
    expect(lignes[0].uniteAchat).toBe('piece(s)');
    expect(lignes[0].prixTotal).toBeCloseTo(9.75, 2);
  });

  it('ignore un repas au-dela de la duree et garde le reste lisible', () => {
    const lignes = coursesCuisine({ repas: [barbecue(1), barbecue(3)], extras: [] }, 10, 1);
    expect(lignes[0].besoin).toBe(1800);
    expect(lignes[0].reste).toBe(200);
  });
});
