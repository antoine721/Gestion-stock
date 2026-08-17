import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import {
  LIBELLE_REGIME,
  REGIMES,
  libelleConsommations,
  logistiqueVierge,
} from '../../domain/invites';
import { fmtEntier } from '../../domain/format';
import { Regime, ReponseFormulaire } from '../../domain/models';

/**
 * La fiche que remplissent les invites eux-memes : qui ils sont, ce qu'ils
 * mangent, ce qu'ils ont envie d'apporter a la fete. Les organisateurs
 * transforment ensuite chaque reponse en invite nomme, rattache au bon
 * co-organisateur.
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
  protected readonly regimes = REGIMES;
  protected readonly libelleRegime = LIBELLE_REGIME;
  protected readonly libelleConsommations = libelleConsommations;

  protected readonly prenom = signal('');
  protected readonly nom = signal('');
  protected readonly invitePar = signal('');
  protected readonly accompagnants = signal(0);
  protected readonly regime = signal<Regime>('omnivore');
  protected readonly allergies = signal('');
  protected readonly preferencesBoissons = signal('');
  protected readonly envies = signal('');
  protected readonly recommandations = signal('');
  protected readonly commentaire = signal('');

  protected readonly envoye = signal(false);
  protected readonly lienCopie = signal(false);

  protected readonly valide = computed(() => this.prenom().trim().length > 0);

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

  protected majAccompagnants(valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.accompagnants.set(Math.max(0, Math.round(nombre)));
  }

  protected envoyer(): void {
    if (!this.valide()) return;
    this.store.ajouterReponse({
      prenom: this.prenom().trim(),
      nom: this.nom().trim(),
      invitePar: this.invitePar().trim(),
      accompagnants: this.accompagnants(),
      regime: this.regime(),
      allergies: this.allergies().trim(),
      preferencesBoissons: this.preferencesBoissons().trim(),
      envies: this.envies().trim(),
      recommandations: this.recommandations().trim(),
      commentaire: this.commentaire().trim(),
      // La conso et la logistique ne se saisissent que sur la page publique.
      consommations: [],
      stylesMusicaux: '',
      logistique: logistiqueVierge(),
    });
    this.vider();
    this.envoye.set(true);
    setTimeout(() => this.envoye.set(false), 3000);
  }

  private vider(): void {
    this.prenom.set('');
    this.nom.set('');
    this.invitePar.set('');
    this.accompagnants.set(0);
    this.regime.set('omnivore');
    this.allergies.set('');
    this.preferencesBoissons.set('');
    this.envies.set('');
    this.recommandations.set('');
    this.commentaire.set('');
  }

  /** Rattache la reponse a un co-organisateur : elle devient un invite nomme. */
  protected importer(reponse: ReponseFormulaire, evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    if (select.value) this.store.importerReponse(reponse.id, select.value);
    select.value = '';
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
