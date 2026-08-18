import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import { BlocCalendrier, Calendrier } from '../calendrier/calendrier';
import {
  TYPES_CRENEAU,
  libelleVolontariat,
  nomDeRef,
  planningDuJour,
} from '../../domain/programme';
import { dateDuJour } from '../../domain/evenement';
import { fmtEntier } from '../../domain/format';
import { Creneau, TypeCreneau } from '../../domain/models';

/** Les deux facons de regarder le meme planning. */
type VueProgramme = 'kanban' | 'calendrier';

/** Le choix de vue tient sur l'appareil, pas dans l'evenement : c'est un gout. */
const CLE_VUE = 'vialcrm.programme.vue';

function vueEnregistree(): VueProgramme {
  return localStorage.getItem(CLE_VUE) === 'calendrier' ? 'calendrier' : 'kanban';
}

/** La saisie minimale d'une mission. */
interface BrouillonCreneau {
  jour: number;
  titre: string;
  debut: string;
  fin: string;
  type: TypeCreneau;
  lieu: string;
}

/**
 * Le programme du festival, sous deux angles. Le kanban empile les missions
 * du jour dans l'ordre : c'est la vue qui se lit vite et qui se remplit vite.
 * Le calendrier les pose a leur heure et a leur duree : c'est la seule qui
 * montre les trous de l'apres-midi et les deux ateliers cales en meme temps.
 *
 * Tout le monde participe — chaque creneau porte ses assignes. La creation
 * ouvre une modale, le detail complet le panneau lateral.
 */
@Component({
  selector: 'app-section-programme',
  imports: [Calendrier, Modale, Panneau],
  templateUrl: './section-programme.html',
  styleUrl: './section-programme.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionProgramme {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly types = TYPES_CRENEAU;
  protected readonly libelleVolontariat = libelleVolontariat;

  /** La vue choisie, gardee d'une visite a l'autre sur cet appareil. */
  protected readonly vue = signal<VueProgramme>(vueEnregistree());

  protected choisirVue(vue: VueProgramme): void {
    this.vue.set(vue);
    localStorage.setItem(CLE_VUE, vue);
  }

  /** Les colonnes du calendrier : un jour, sa date quand elle est calee. */
  protected readonly colonnesCalendrier = computed(() =>
    this.journees().map((x) => ({ jour: x.jour, date: x.date })),
  );

  /**
   * Les missions traduites en blocs. L'etat de l'equipe fait la couleur : une
   * mission sans personne dessus doit sauter aux yeux dans le calendrier
   * comme elle saute aux yeux dans le kanban.
   */
  protected readonly blocsCalendrier = computed<BlocCalendrier[]>(() =>
    this.store.programme().creneaux.map((creneau) => ({
      id: creneau.id,
      jour: creneau.jour,
      debut: creneau.debut,
      fin: creneau.fin,
      titre: creneau.titre || 'Sans titre',
      detail: [
        creneau.lieu,
        creneau.assignes
          .map((x) => this.nomDe(x))
          .filter(Boolean)
          .join(', '),
      ]
        .filter((x) => x.length > 0)
        .join(' · '),
      emoji: this.emojiDe(creneau.type),
      ton: creneau.assignes.length > 0 ? 'ok' : 'warn',
    })),
  );

  protected readonly journees = computed(() => {
    const programme = this.store.programme();
    const jours = Math.max(1, this.store.partage().jours);
    // Avec une date de debut posee au profil, chaque colonne porte sa vraie date.
    const format = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return Array.from({ length: jours }, (_, i) => {
      const date = dateDuJour(this.store.infos().debut, i + 1);
      return {
        jour: i + 1,
        date: date ? format.format(date) : '',
        creneaux: planningDuJour(programme, i + 1),
      };
    });
  });

  protected readonly jours = computed(() =>
    Array.from({ length: Math.max(1, this.store.partage().jours) }, (_, i) => i + 1),
  );

  protected emojiDe(type: TypeCreneau): string {
    return TYPES_CRENEAU.find((x) => x.id === type)?.emoji ?? '📌';
  }

  protected nomDe(ref: string): string {
    return nomDeRef(ref, this.store.participants(), this.store.invitesNommes());
  }

  // -- Creation --------------------------------------------------------------

  protected readonly creationOuverte = signal(false);
  protected readonly brouillon = signal<BrouillonCreneau>({
    jour: 1,
    titre: '',
    debut: '',
    fin: '',
    type: 'activite',
    lieu: '',
  });

  protected readonly creationInvalide = computed(() => this.brouillon().titre.trim() === '');

  protected ouvrirCreation(jour: number): void {
    this.brouillon.set({ jour, titre: '', debut: '', fin: '', type: 'activite', lieu: '' });
    this.creationOuverte.set(true);
  }

  protected majBrouillon(patch: Partial<BrouillonCreneau>): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected creer(): void {
    const brouillon = this.brouillon();
    if (!brouillon.titre.trim()) return;
    const id = this.store.ajouterCreneau(brouillon.jour);
    this.store.majCreneau(id, {
      titre: brouillon.titre.trim(),
      debut: brouillon.debut.trim(),
      fin: brouillon.fin.trim(),
      type: brouillon.type,
      lieu: brouillon.lieu.trim(),
    });
    this.creationOuverte.set(false);
    // La mission neuve s'ouvre dans le panneau : il reste l'equipe a poser.
    this.detailId.set(id);
  }

  // -- Detail ----------------------------------------------------------------

  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.store.programme().creneaux.find((x) => x.id === this.detailId()),
  );

  protected maj(creneau: Creneau, patch: Partial<Omit<Creneau, 'id'>>): void {
    this.store.majCreneau(creneau.id, patch);
  }

  protected majJour(creneau: Creneau, valeur: string): void {
    const jour = Number(valeur);
    if (Number.isFinite(jour)) this.maj(creneau, { jour: Math.max(1, Math.round(jour)) });
  }

  protected assigner(creneau: Creneau, evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    if (select.value) this.store.assignerPersonne(creneau.id, select.value);
    select.value = '';
  }

  protected supprimer(creneau: Creneau): void {
    if (confirm(`Retirer « ${creneau.titre || 'ce creneau'} » du planning ?`)) {
      this.store.supprimerCreneau(creneau.id);
      if (this.detailId() === creneau.id) this.detailId.set('');
    }
  }
}
