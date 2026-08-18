import { PersonneType } from './models';

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
 * Un profil vierge. C'est le seul point de depart : l'app ne pose plus de
 * bibliotheque toute faite a la creation d'un evenement, chaque groupe decrit
 * ses propres buveurs.
 */
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
