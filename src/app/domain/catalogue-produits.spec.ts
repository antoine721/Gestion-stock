import { describe, expect, it } from 'vitest';
import {
  ProduitCatalogue,
  chercherProduits,
  normaliserProduitCatalogue,
  normaliserTexte,
} from './catalogue-produits';

function produit(nom: string, extra: Partial<ProduitCatalogue> = {}): ProduitCatalogue {
  return normaliserProduitCatalogue({ code: nom, nom, categorie: 'nourriture', ...extra });
}

const CATALOGUE: ProduitCatalogue[] = [
  produit('Bière blonde Koenigsbier', { categorie: 'alcool', prix: 0.29 }),
  produit('Bière sans alcool Carrefour', { categorie: 'soft', prix: 0.35 }),
  produit('Vin rouge tempranillo Carrefour', { categorie: 'alcool', prix: 1.05 }),
  produit('Vinaigre de vin blanc Carrefour', { prix: 0.65 }),
  produit('Papier toilette 2 épaisseurs Simpl Choice', {
    categorie: 'intendance',
    conditionnement: '12 rouleaux',
    prix: 2.1,
  }),
  produit('Cola zéro Carrefour', { categorie: 'soft', prix: 0.32 }),
];

describe('normaliserTexte', () => {
  it('enleve les accents et les majuscules', () => {
    expect(normaliserTexte('Bière Ambrée')).toBe('biere ambree');
  });
});

describe('chercherProduits', () => {
  it('trouve un produit malgre les accents manquants', () => {
    const trouves = chercherProduits(CATALOGUE, 'biere');
    expect(trouves.map((x) => x.nom)).toEqual([
      'Bière blonde Koenigsbier',
      'Bière sans alcool Carrefour',
    ]);
  });

  it('exige tous les mots tapes', () => {
    const trouves = chercherProduits(CATALOGUE, 'biere sans alcool');
    expect(trouves.map((x) => x.nom)).toEqual(['Bière sans alcool Carrefour']);
  });

  it('fait passer le mot entier avant le debut de mot', () => {
    // « vin » est un mot entier dans « Vin rouge », un simple prefixe dans
    // « Vinaigre » : le vin sort en premier.
    const trouves = chercherProduits(CATALOGUE, 'vin');
    expect(trouves[0].nom).toBe('Vin rouge tempranillo Carrefour');
  });

  it('comprend les mots qu on tape vraiment', () => {
    const trouves = chercherProduits(CATALOGUE, 'pq');
    expect(trouves.map((x) => x.nom)).toEqual(['Papier toilette 2 épaisseurs Simpl Choice']);
    expect(chercherProduits(CATALOGUE, 'coca')[0].nom).toBe('Cola zéro Carrefour');
  });

  it('cherche aussi dans le conditionnement', () => {
    expect(chercherProduits(CATALOGUE, 'rouleaux').length).toBe(1);
  });

  it('ne renvoie rien sur une requete vide ou inconnue', () => {
    expect(chercherProduits(CATALOGUE, '   ')).toEqual([]);
    expect(chercherProduits(CATALOGUE, 'tronconneuse')).toEqual([]);
  });

  it('respecte la limite demandee', () => {
    expect(chercherProduits(CATALOGUE, 'carrefour', 2).length).toBe(2);
  });
});

describe('normaliserProduitCatalogue', () => {
  it('complete une entree incomplete plutot que de casser l ecran', () => {
    const complete = normaliserProduitCatalogue({ nom: 'Charbon' });
    expect(complete).toEqual({
      code: '',
      nom: 'Charbon',
      marque: '',
      imageUrl: '',
      categorie: 'autre',
      contenance: 0,
      unite: 'piece',
      conditionnement: '',
      prix: 0,
    });
  });
});
