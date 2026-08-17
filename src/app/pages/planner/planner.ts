import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Extras } from '../../components/extras/extras';
import { HubAccueil } from '../../components/hub-accueil/hub-accueil';
import { ListeCourses } from '../../components/liste-courses/liste-courses';
import { PersonnesTypes } from '../../components/personnes-types/personnes-types';
import { ReglagesForm } from '../../components/reglages-form/reglages-form';
import { RepartitionPanel } from '../../components/repartition-panel/repartition-panel';
import { SectionCourses } from '../../components/section-courses/section-courses';
import { SectionDj } from '../../components/section-dj/section-dj';
import { SectionFormulaire } from '../../components/section-formulaire/section-formulaire';
import { SectionMateriel } from '../../components/section-materiel/section-materiel';
import { SectionNourriture } from '../../components/section-nourriture/section-nourriture';
import { SectionProfil } from '../../components/section-profil/section-profil';
import { SectionProgramme } from '../../components/section-programme/section-programme';
import { SectionStats } from '../../components/section-stats/section-stats';
import { SectionUtilisateurs } from '../../components/section-utilisateurs/section-utilisateurs';
import { ValidationPanel } from '../../components/validation-panel/validation-panel';
import { VisiteGuidee } from '../../components/visite-guidee/visite-guidee';
import { Logo } from '../../components/logo/logo';
import { ESPACES, Espace, PlannerStore, SECTIONS } from '../../state/planner-store';
import { SessionStore } from '../../state/session';
import { ThemeStore } from '../../state/theme';
import { fmtEntier, fmtEuro } from '../../domain/format';
import { joursAvant } from '../../domain/evenement';

/** Le tuto ne se montre qu'a la premiere connexion sur l'appareil. */
const CLE_VISITE = 'vialcrm.visite';

/**
 * Le hub de l'evenement : une sidebar par piece (bar, nourriture, invites,
 * materiel, courses, stats, formulaire) et un accueil-dashboard qui resume
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
    SectionDj,
    SectionFormulaire,
    SectionMateriel,
    SectionNourriture,
    SectionProfil,
    SectionProgramme,
    SectionStats,
    SectionUtilisateurs,
    ValidationPanel,
    VisiteGuidee,
    Logo,
  ],
  templateUrl: './planner.html',
  styleUrl: './planner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Planner {
  protected readonly store = inject(PlannerStore);
  protected readonly theme = inject(ThemeStore);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly sections = SECTIONS;
  protected readonly espaces = ESPACES;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtEuro = fmtEuro;

  /** La sidebar en trois familles, comme un outil de travail. */
  protected readonly groupes: { titre: string; ids: Espace[] }[] = [
    { titre: 'Menu', ids: ['accueil', 'profil'] },
    { titre: 'Espaces', ids: ['alcool', 'nourriture', 'utilisateurs', 'materiel', 'courses'] },
    { titre: 'Festival', ids: ['programme', 'dj', 'stats', 'formulaire'] },
  ];
  protected readonly espaceParId = new Map(ESPACES.map((x) => [x.id, x]));

  protected readonly lienCopie = signal(false);
  protected readonly visiteOuverte = signal(false);

  protected readonly code = computed(() => this.route.snapshot.paramMap.get('code') ?? '');

  protected readonly prenom = computed(() => this.session.session()?.prenom ?? '');
  protected readonly initiales = computed(() => this.prenom().slice(0, 2).toUpperCase() || '·');

  constructor() {
    void this.demarrer();
  }

  /** Fin (ou passage) du tuto : on ne le remontre plus a cette personne. */
  protected fermerVisite(): void {
    localStorage.setItem(CLE_VISITE, 'vue');
    this.visiteOuverte.set(false);
  }

  /** Le petit chiffre a droite de chaque entree de la sidebar. */
  protected indicateurDe(espace: Espace): string {
    switch (espace) {
      case 'profil': {
        const avant = joursAvant(this.store.infos().debut, new Date());
        return avant !== null && avant > 0 ? `J-${avant}` : '';
      }
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
      case 'dj': {
        const resume = this.store.resumeDj();
        return resume.total > 0 ? `${resume.valides}/${resume.total}` : '';
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
      // Premiere visite sur cet appareil : le tuto se lance une fois la page posee.
      if (!localStorage.getItem(CLE_VISITE)) {
        setTimeout(() => this.visiteOuverte.set(true), 600);
      }
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
