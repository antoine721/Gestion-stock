import { ConsommationType, PersonneType } from './models';

/** Frimousses proposees a la creation d'un profil. Aucune image a charger. */
export const EMOJIS_PROFIL: readonly string[] = [
  '🍺',
  '🍻',
  '🥂',
  '🍾',
  '🍷',
  '🍸',
  '🍹',
  '🥃',
  '🧉',
  '🥤',
  '🧃',
  '💧',
  '🧊',
  '🍋',
  '🌴',
  '☕',
  '🕺',
  '💃',
  '🎉',
  '🎸',
  '😎',
  '🚗',
  '🤰',
  '👶',
];

/**
 * Bibliotheque de depart d'un nouvel evenement. Ce sont des profils qu'on
 * reconnait dans n'importe quel groupe de potes : chacun les renomme, les
 * ajuste ou les supprime.
 *
 * Les consommations sont exprimees PAR JOUR et par personne de ce profil.
 */
export const PERSONNES_TYPES_PAR_DEFAUT: readonly Omit<PersonneType, 'id' | 'creeParNom'>[] = [
  {
    emoji: '🍺',
    nom: 'Le buveur de biere',
    description: "Arrive avec une biere a la main et n'en change pas de la soiree.",
    consommation: conso([['biere', 6]]),
  },
  {
    emoji: '🥂',
    nom: 'La team spritz',
    description: 'Spritz sur spritz en debut de soiree, puis un verre de rose.',
    consommation: conso([
      ['spritz', 3],
      ['rose', 1],
    ]),
  },
  {
    emoji: '🍹',
    nom: 'Cocktails et shots',
    description: 'Enchaine les longs drinks, et il y aura des shots vers minuit.',
    consommation: conso([
      ['whisky-coca', 3],
      ['vodka-orange', 1],
      ['jagger-shot', 2],
    ]),
  },
  {
    emoji: '🍷',
    nom: 'Vin seulement',
    description: 'Ne touche ni aux spiritueux ni a la biere. Un ou deux verres, pas plus.',
    consommation: conso([
      ['vin-blanc', 2],
      ['rose', 1],
    ]),
  },
  {
    emoji: '🥤',
    nom: 'Le raisonnable',
    description: 'Boit un peu, alterne avec des softs, conduit peut-etre au retour.',
    consommation: conso([
      ['biere', 2],
      ['soft-jus', 2],
    ]),
  },
  {
    emoji: '🚗',
    nom: 'Ne boit pas',
    description: 'Conducteur, enceinte, mineur ou simplement pas envie. A soif quand meme.',
    consommation: conso([
      ['soft-jus', 2],
      ['soft-soda', 2],
      ['soft-eau', 1],
    ]),
  },
];

function conso(lignes: [string, number][]): ConsommationType[] {
  return lignes.map(([boissonId, verresParJour]) => ({ boissonId, verresParJour }));
}

/** Un profil vierge, quand on part de rien. */
export function personneTypeVierge(id: string, creeParNom: string): PersonneType {
  return {
    id,
    nom: 'Nouveau profil',
    description: '',
    emoji: '🥂',
    creeParNom,
    consommation: [],
  };
}

export function personnesTypesInitiales(creeParNom: string, id: () => string): PersonneType[] {
  return PERSONNES_TYPES_PAR_DEFAUT.map((modele) => ({
    ...modele,
    id: id(),
    creeParNom,
    consommation: modele.consommation.map((x) => ({ ...x })),
  }));
}
