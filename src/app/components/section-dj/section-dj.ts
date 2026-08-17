import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import {
  STATUTS_DJ_SET,
  libelleVolontariat,
  nomDeRef,
  trierDjSets,
  volontairesDj,
} from '../../domain/programme';
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
 * Le coin DJ : le tableau horaire des sets et son workflow. Un invite
 * demande un creneau, l'orga valide (ou refuse), et le set finit « joue ».
 * La creation passe par une modale, le suivi par le panneau lateral.
 */
@Component({
  selector: 'app-section-dj',
  imports: [Modale, Panneau],
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

  protected ouvrirCreation(dj = ''): void {
    this.brouillon.set({ jour: 1, debut: '', fin: '', dj, style: '', statut: 'demande' });
    this.creationOuverte.set(true);
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
