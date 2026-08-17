import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { LIBELLE_REGIME } from '../../domain/invites';
import { libelleGoodies, libelleServices } from '../../domain/preferences';
import { fmtEntier } from '../../domain/format';
import { ReponseFormulaire } from '../../domain/models';

/**
 * L'espace Formulaire : le lien public a distribuer, et ce qui en revient.
 *
 * La fiche elle-meme se remplit sur la page publique — il n'y a pas de
 * deuxieme saisie ici : pour poser une fiche a la main, l'espace Invites fait
 * mieux, il cree directement un invite nomme au lieu d'une reponse a valider.
 */
@Component({
  selector: 'app-section-formulaire',
  templateUrl: './section-formulaire.html',
  styleUrl: './section-formulaire.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionFormulaire {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly libelleRegime = LIBELLE_REGIME;
  protected readonly libelleServices = libelleServices;
  protected readonly libelleGoodies = libelleGoodies;

  protected readonly lienCopie = signal(false);

  /** Combien de reponses attendent encore d'etre validees en fiches. */
  protected readonly enAttente = computed(() => this.store.reponsesFormulaire().length);

  /** Le lien public : c'est lui qu'on balance dans le groupe WhatsApp. */
  protected async copierLien(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.store.lienFormulaire());
      this.lienCopie.set(true);
      setTimeout(() => this.lienCopie.set(false), 2000);
    } catch {
      // Presse-papier refuse : le lien reste affiche, a selectionner a la main.
    }
  }

  protected supprimer(reponse: ReponseFormulaire): void {
    if (confirm(`Supprimer la reponse de ${reponse.prenom} ?`)) {
      this.store.supprimerReponse(reponse.id);
    }
  }

  protected dateDe(reponse: ReponseFormulaire): string {
    const date = new Date(reponse.creeLe);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
  }
}
