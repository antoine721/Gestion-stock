import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Extras } from '../../components/extras/extras';
import { HubAccueil } from '../../components/hub-accueil/hub-accueil';
import { ListeCourses } from '../../components/liste-courses/liste-courses';
import { PersonnesTypes } from '../../components/personnes-types/personnes-types';
import { ReglagesForm } from '../../components/reglages-form/reglages-form';
import { RepartitionPanel } from '../../components/repartition-panel/repartition-panel';
import { SectionCourses } from '../../components/section-courses/section-courses';
import { SectionFormulaire } from '../../components/section-formulaire/section-formulaire';
import { SectionMateriel } from '../../components/section-materiel/section-materiel';
import { SectionNourriture } from '../../components/section-nourriture/section-nourriture';
import { SectionProgramme } from '../../components/section-programme/section-programme';
import { SectionStats } from '../../components/section-stats/section-stats';
import { SectionUtilisateurs } from '../../components/section-utilisateurs/section-utilisateurs';
import { ValidationPanel } from '../../components/validation-panel/validation-panel';
import { ESPACES, Espace, PlannerStore, SECTIONS } from '../../state/planner-store';
import { SessionStore } from '../../state/session';
import { fmtEntier, fmtEuro } from '../../domain/format';

/**
 * Le hub de l'evenement : une sidebar par piece (bar, nourriture, invites,
 * materiel, courses, stats, formulaire) et un accueil en cards qui resume
 * tout. Les invites se declarent dans la base d'invites — il n'y a plus de
 * saisie par co-organisateur dans l'espace bar.
 */
@Component({
  selector: 'app-planner',
  imports: [
    Extras,
    HubAccueil,
    ListeCourses,
    PersonnesTypes,
    ReglagesForm,
    RepartitionPanel,
    SectionCourses,
    SectionFormulaire,
    SectionMateriel,
    SectionNourriture,
    SectionProgramme,
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

  protected readonly sections = SECTIONS;
  protected readonly espaces = ESPACES;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtEuro = fmtEuro;

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
      case 'courses': {
        const resume = this.store.resumeCourses();
        return resume.lignes > 0 ? `${resume.cochees}/${resume.lignes}` : '';
      }
      case 'programme': {
        const resume = this.store.resumeProgramme();
        return resume.creneaux > 0 ? fmtEntier(resume.creneaux) : '';
      }
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

  protected async quitter(): Promise<void> {
    this.store.fermer();
    await this.router.navigate(['/evenements']);
  }
}
