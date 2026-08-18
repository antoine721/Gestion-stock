import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import { BlocCalendrier, Calendrier } from '../calendrier/calendrier';
import {
  STATUTS_DJ_SET,
  libelleVolontariat,
  nomDeRef,
  trierDjSets,
  volontairesDj,
} from '../../domain/programme';
import { dateDuJour } from '../../domain/evenement';
import { fmtEntier } from '../../domain/format';
import { DjSet, StatutDjSet } from '../../domain/models';

/** La saisie minimale d'un set : qui, quand, quel statut. */
interface BrouillonSet {
  jour: number;
  debut: string;
  fin: string;
  dj: string;
  style: string;
  statut: StatutDjSet;
}

/**
 * Le coin DJ : la nuit en calendrier, et le workflow des sets. Un invite
 * demande un creneau, l'orga valide (ou refuse), et le set finit « joue ».
 *
 * Le calendrier passe devant le tableau parce que c'est la question qu'on se
 * pose ici : est-ce que la soiree est couverte, et est-ce que deux DJ ne sont
 * pas programmes en meme temps ? Un tableau trie ne le dit pas.
 */
@Component({
  selector: 'app-section-dj',
  imports: [Calendrier, Modale, Panneau],
  templateUrl: './section-dj.html',
  styleUrl: './section-dj.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionDj {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly statuts = STATUTS_DJ_SET;
  protected readonly libelleVolontariat = libelleVolontariat;

  protected readonly sets = computed(() => trierDjSets(this.store.djSets()));

  /** Les colonnes du calendrier : un jour du festival, avec sa date. */
  protected readonly colonnesCalendrier = computed(() => {
    const format = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return this.jours().map((jour) => {
      const date = dateDuJour(this.store.infos().debut, jour);
      return { jour, date: date ? format.format(date) : '' };
    });
  });

  /**
   * Les sets en blocs. Le statut fait la couleur : un set refuse s'efface, un
   * set encore en demande reste en alerte tant que personne n'a tranche.
   */
  protected readonly blocsCalendrier = computed<BlocCalendrier[]>(() =>
    this.store.djSets().map((set) => ({
      id: set.id,
      jour: set.jour,
      debut: set.debut,
      fin: set.fin,
      titre: set.dj ? this.nomDe(set.dj) : 'DJ a definir',
      detail: set.style,
      emoji: '🎧',
      ton: this.tonStatut(set.statut) || 'neutre',
    })),
  );

  protected readonly jours = computed(() =>
    Array.from({ length: Math.max(1, this.store.partage().jours) }, (_, i) => i + 1),
  );

  /** Les invites qui se sont proposes comme DJ, d'apres leurs fiches. */
  protected readonly volontairesDj = computed(() => volontairesDj(this.store.invitesNommes()));

  protected nomDe(ref: string): string {
    return nomDeRef(ref, this.store.participants(), this.store.invitesNommes()) || ref;
  }

  protected libelleStatut(id: string): string {
    return STATUTS_DJ_SET.find((x) => x.id === id)?.libelle ?? '';
  }

  /** La couleur de la pilule : valide et joue sont acquis, refuse est mort. */
  protected tonStatut(statut: StatutDjSet): 'ok' | 'warn' | 'ko' | '' {
    if (statut === 'valide' || statut === 'joue') return 'ok';
    if (statut === 'demande') return 'warn';
    if (statut === 'refuse') return 'ko';
    return '';
  }

  protected creneauDe(set: DjSet): string {
    if (!set.debut) return '—';
    return set.fin ? `${set.debut} – ${set.fin}` : set.debut;
  }

  // -- Creation --------------------------------------------------------------

  protected readonly creationOuverte = signal(false);
  protected readonly brouillon = signal<BrouillonSet>({
    jour: 1,
    debut: '',
    fin: '',
    dj: '',
    style: '',
    statut: 'demande',
  });

  protected ouvrirCreation(dj = '', jour = 1): void {
    this.brouillon.set({ jour, debut: '', fin: '', dj, style: '', statut: 'demande' });
    this.creationOuverte.set(true);
  }

  /** Le « + » d'une colonne du calendrier : un set neuf, ce jour-la. */
  protected ouvrirCreationJour(jour: number): void {
    this.ouvrirCreation('', jour);
  }

  protected majBrouillon(patch: Partial<BrouillonSet>): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected creer(): void {
    const brouillon = this.brouillon();
    const id = this.store.ajouterDjSet({
      jour: Math.max(1, brouillon.jour),
      debut: brouillon.debut.trim(),
      fin: brouillon.fin.trim(),
      dj: brouillon.dj,
      style: brouillon.style.trim(),
      statut: brouillon.statut,
    });
    this.creationOuverte.set(false);
    this.detailId.set(id);
  }

  /** Un volontaire arrive pre-rempli dans la modale de creation. */
  protected proposerVolontaire(inviteId: string): void {
    this.ouvrirCreation(`inv:${inviteId}`);
  }

  // -- Detail ----------------------------------------------------------------

  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.store.djSets().find((x) => x.id === this.detailId()),
  );

  protected maj(set: DjSet, patch: Partial<Omit<DjSet, 'id'>>): void {
    this.store.majDjSet(set.id, patch);
  }

  protected majJour(set: DjSet, valeur: string): void {
    const jour = Number(valeur);
    if (Number.isFinite(jour)) this.store.majDjSet(set.id, { jour: Math.max(1, Math.round(jour)) });
  }

  protected supprimer(set: DjSet): void {
    if (confirm(`Retirer ce set (${this.nomDe(set.dj) || 'sans DJ'}) du tableau ?`)) {
      this.store.supprimerDjSet(set.id);
      if (this.detailId() === set.id) this.detailId.set('');
    }
  }
}
