import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EffectifsForm } from '../../components/effectifs-form/effectifs-form';
import { Extras } from '../../components/extras/extras';
import { ListeCourses } from '../../components/liste-courses/liste-courses';
import { PersonnesTypes } from '../../components/personnes-types/personnes-types';
import { ReglagesForm } from '../../components/reglages-form/reglages-form';
import { ResumePanel } from '../../components/resume-panel/resume-panel';
import { RepartitionPanel } from '../../components/repartition-panel/repartition-panel';
import { ValidationPanel } from '../../components/validation-panel/validation-panel';
import { ONGLET_EVENEMENT, PlannerStore, SECTIONS } from '../../state/planner-store';
import { SessionStore } from '../../state/session';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { invitesDe } from '../../domain/calcul';

@Component({
  selector: 'app-planner',
  imports: [
    EffectifsForm,
    Extras,
    ListeCourses,
    PersonnesTypes,
    ReglagesForm,
    RepartitionPanel,
    ResumePanel,
    ValidationPanel,
  ],
  templateUrl: './planner.html',
  styleUrl: './planner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Planner {
  protected readonly store = inject(PlannerStore);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly evenement = ONGLET_EVENEMENT;
  protected readonly sections = SECTIONS;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtEuro = fmtEuro;

  protected readonly coutParPersonne = computed(() => {
    const invites = Math.max(1, this.store.cadre().invites);
    return this.store.panier().coutTotal / invites;
  });
  protected readonly invitesDe = invitesDe;
  protected readonly lienCopie = signal(false);

  protected readonly code = computed(() => this.route.snapshot.paramMap.get('code') ?? '');

  constructor() {
    // L'onglet ouvert par defaut est le mien : c'est ma saisie que je viens faire.
    effect(() => {
      const moi = this.store.moi();
      if (moi && this.store.onglet() === ONGLET_EVENEMENT && this.premierRendu) {
        this.premierRendu = false;
        this.store.onglet.set(moi.id);
      }
    });

    void this.demarrer();
  }

  private premierRendu = true;

  /**
   * A l'ouverture : je me declare comme co-organisateur (idempotent sur le
   * prenom), puis je charge l'evenement.
   */
  private async demarrer(): Promise<void> {
    const prenom = this.session.session()?.prenom;
    if (!prenom) return;

    try {
      await this.store.rejoindre(this.code(), prenom);
      await this.store.ouvrir(this.code());
    } catch {
      // Le store expose deja l'erreur ; rien a ajouter ici.
    }
  }

  protected async copierLien(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.store.lienPartage());
      this.lienCopie.set(true);
      setTimeout(() => this.lienCopie.set(false), 2000);
    } catch {
      // Presse-papier refuse : le lien reste affiche, a selectionner a la main.
    }
  }

  protected async ajouterParticipant(): Promise<void> {
    const nom = prompt('Prenom du co-organisateur a ajouter ?');
    if (nom?.trim()) await this.store.ajouterParticipant(nom.trim());
  }

  protected async retirer(participantId: string, nom: string): Promise<void> {
    if (confirm(`Retirer ${nom} et ses invites de l'evenement ?`)) {
      await this.store.retirerParticipant(participantId);
    }
  }

  protected async quitter(): Promise<void> {
    this.store.fermer();
    await this.router.navigate(['/evenements']);
  }
}
