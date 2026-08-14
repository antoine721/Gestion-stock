import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { fmtEntier, fmtEuro, fmtNombre, fmtVolume } from '../../domain/format';

/**
 * La vue d'ensemble chiffree : le budget global par poste, qui paye quoi, et
 * ce qui reste a preparer. C'est la page qu'on ouvre pour repondre a « on en
 * est ou ? » sans refaire le tour de toutes les pieces.
 */
@Component({
  selector: 'app-section-stats',
  templateUrl: './section-stats.html',
  styleUrl: './section-stats.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionStats {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;
  protected readonly fmtVolume = fmtVolume;

  /** Seuls les postes non vides occupent la barre de composition. */
  protected readonly postes = computed(() =>
    this.store.budgetGlobal().postes.filter((x) => x.montant > 0),
  );

  protected readonly partMax = computed(() =>
    this.store.repartitionGlobale().reduce((max, x) => Math.max(max, x.part), 0),
  );

  protected readonly avancesPresentes = computed(() =>
    this.store.repartitionGlobale().some((x) => x.avance > 0),
  );

  protected readonly coutParBuveur = computed(() => {
    const buveurs = this.store.buveurs();
    return buveurs > 0 ? this.store.panier().coutBase / buveurs : 0;
  });

  /** Ce qui reste a faire, toutes pieces confondues : la todo de la fete. */
  protected readonly resteAFaire = computed(() => {
    const taches: {
      espace: 'alcool' | 'nourriture' | 'utilisateurs' | 'materiel' | 'courses' | 'formulaire';
      texte: string;
    }[] = [];
    const nourriture = this.store.budgetNourriture();
    if (nourriture.repasManquants > 0) {
      taches.push({
        espace: 'nourriture',
        texte: `${nourriture.repasManquants} repas sans plat prevu`,
      });
    }
    const materiel = this.store.budgetMateriel();
    if (materiel.aPrevoir > 0) {
      taches.push({
        espace: 'materiel',
        texte: `${materiel.aPrevoir} article(s) encore a prevoir`,
      });
    }
    const sansProfil = this.store.invitesNommes().filter((x) => !x.personneTypeId).length;
    if (sansProfil > 0) {
      taches.push({ espace: 'utilisateurs', texte: `${sansProfil} invite(s) sans profil alcool` });
    }
    const reponses = this.store.reponsesFormulaire().length;
    if (reponses > 0) {
      taches.push({
        espace: 'formulaire',
        texte: `${reponses} reponse(s) de formulaire a rattacher`,
      });
    }
    const alertes = this.store.alertes().length;
    if (alertes > 0) {
      taches.push({ espace: 'alcool', texte: `${alertes} alerte(s) sur la liste de courses` });
    }
    const encaissements = this.store.encaissements();
    if (encaissements.enAttente > 0) {
      taches.push({
        espace: 'utilisateurs',
        texte: `${encaissements.enAttente} paiement(s) en attente`,
      });
    }
    const courses = this.store.resumeCourses();
    if (courses.lignes > 0 && courses.cochees < courses.lignes) {
      taches.push({
        espace: 'courses',
        texte: `${courses.lignes - courses.cochees} ligne(s) de courses a acheter`,
      });
    }
    return taches;
  });
}
