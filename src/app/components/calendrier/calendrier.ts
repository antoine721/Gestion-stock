import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { construireCalendrier } from '../../domain/calendrier';

/**
 * Un bloc a poser sur le calendrier. L'appelant traduit ses propres objets —
 * missions du programme, sets DJ — en cette forme neutre : le calendrier ne
 * sait rien du festival, il sait dessiner des heures.
 */
export interface BlocCalendrier {
  id: string;
  jour: number;
  debut: string;
  fin: string;
  titre: string;
  /** Une ligne de contexte sous le titre : lieu, DJ, equipe. */
  detail: string;
  emoji: string;
  /** Teinte du bloc : reprend le vocabulaire d'etat de l'app. */
  ton: 'ok' | 'warn' | 'ko' | 'neutre';
}

export interface ColonneCalendrier {
  jour: number;
  /** La vraie date quand elle est calee au profil, sinon vide. */
  date: string;
}

/**
 * La vue calendrier : les heures en ordonnee, les jours en abscisse, et les
 * blocs poses a leur place et a leur duree. C'est la vue qui repond a « qu'est-ce
 * qui se chevauche ? » — ce qu'une liste chronologique ne montre jamais.
 *
 * Ce qui n'a pas d'heure lisible ne s'invente pas une place : ces blocs
 * s'alignent au-dessus de la grille, en attente d'etre cales.
 */
@Component({
  selector: 'app-calendrier',
  templateUrl: './calendrier.html',
  styleUrl: './calendrier.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendrier {
  readonly colonnes = input<readonly ColonneCalendrier[]>([]);
  readonly blocs = input<readonly BlocCalendrier[]>([]);
  /** L'id du bloc actuellement ouvert dans un panneau, mis en avant. */
  readonly actif = input('');
  readonly videLibelle = input('Rien de prevu.');

  readonly choisi = output<string>();
  /** Le « + » d'une colonne : ajouter quelque chose ce jour-la. */
  readonly ajout = output<number>();

  private readonly grille = computed(() => construireCalendrier(this.blocs()));

  protected readonly heures = computed(() => this.grille().heures);

  /** Une ligne d'heure sur deux porte son libelle quand la grille est longue. */
  protected readonly pasLibelle = computed(() => (this.grille().heures.length > 14 ? 2 : 1));

  protected readonly hauteurPx = computed(() =>
    Math.max(320, (this.grille().heures.length - 1) * 52),
  );

  /** Les blocs places, colonne par colonne, prets a etre dessines. */
  protected readonly journees = computed(() => {
    const places = new Map(this.grille().places.map((x) => [x.id, x]));
    const blocs = this.blocs();
    return this.colonnes().map((colonne) => ({
      ...colonne,
      poses: blocs
        .filter((bloc) => bloc.jour === colonne.jour && places.has(bloc.id))
        .map((bloc) => {
          const place = places.get(bloc.id)!;
          // Un demi-point d'ecart entre deux blocs voisins : ils se touchent
          // sans se coller, et la colonne reste lisible.
          const largeur = 100 / place.colonnes;
          return {
            bloc,
            haut: place.hautPct,
            hauteur: place.hauteurPct,
            gauche: place.colonne * largeur,
            largeur: largeur - (place.colonnes > 1 ? 1.5 : 0),
          };
        }),
    }));
  });

  /** Ce qui n'a pas d'heure : a caler, jour par jour. */
  protected readonly aCaler = computed(() => {
    const sansHeure = new Set(this.grille().sansHeure);
    return this.blocs().filter((x) => sansHeure.has(x.id));
  });
}
