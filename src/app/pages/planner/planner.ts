import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EffectifsForm } from '../../components/effectifs-form/effectifs-form';
import { Extras } from '../../components/extras/extras';
import { HubAccueil } from '../../components/hub-accueil/hub-accueil';
import { ListeCourses } from '../../components/liste-courses/liste-courses';
import { PersonnesTypes } from '../../components/personnes-types/personnes-types';
import { ReglagesForm } from '../../components/reglages-form/reglages-form';
import { ResumePanel } from '../../components/resume-panel/resume-panel';
import { RepartitionPanel } from '../../components/repartition-panel/repartition-panel';
import { SectionFormulaire } from '../../components/section-formulaire/section-formulaire';
import { SectionMateriel } from '../../components/section-materiel/section-materiel';
import { SectionNourriture } from '../../components/section-nourriture/section-nourriture';
import { SectionStats } from '../../components/section-stats/section-stats';
import { SectionUtilisateurs } from '../../components/section-utilisateurs/section-utilisateurs';
import { ValidationPanel } from '../../components/validation-panel/validation-panel';
import {
  ESPACES,
  Espace,
  ONGLET_EVENEMENT,
  PlannerStore,
  SECTIONS,
} from '../../state/planner-store';
import { SessionStore } from '../../state/session';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { invitesDe } from '../../domain/calcul';

/**
 * Le hub de l'evenement : une sidebar par piece (bar, nourriture, invites,
 * materiel, stats, formulaire) et un accueil en cards qui resume tout.
 * L'ancienne page — onglets par co-organisateur et sections du bar — vit
 * desormais dans l'espace « Bar & boissons ».
 */
@Component({
  selector: 'app-planner',
  imports: [
    EffectifsForm,
    Extras,
    HubAccueil,
    ListeCourses,
    PersonnesTypes,
    ReglagesForm,
    RepartitionPanel,
    ResumePanel,
    SectionFormulaire,
    SectionMateriel,
    SectionNourriture,
    SectionStats,
    SectionUtilisateurs,
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
  protected readonly espaces = ESPACES;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtEuro = fmtEuro;

  protected readonly invitesDe = invitesDe;
  protected readonly lienCopie = signal(false);

  protected readonly code = computed(() => this.route.snapshot.paramMap.get('code') ?? '');

  constructor() {
    void this.demarrer();
  }

  /** Le petit chiffre a droite de chaque entree de la sidebar. */
  protected indicateurDe(espace: Espace): string {
    switch (espace) {
      case 'alcool':
        return fmtEuro(this.store.panier().coutTotal);
      case 'nourriture':
        return fmtEuro(this.store.budgetNourriture().total);
      case 'utilisateurs':
        return fmtEntier(this.store.invitesNommes().length);
      case 'materiel':
        return fmtEuro(this.store.budgetMateriel().total);
      case 'formulaire':
        return fmtEntier(this.store.reponsesFormulaire().length);
      default:
        return '';
    }
  }

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
