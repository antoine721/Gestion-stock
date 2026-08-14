import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, EvenementResume } from '../../state/api';
import { SessionStore } from '../../state/session';
import { partageInitial } from '../../state/planner-store';

/** La vue d'entree : choisir un evenement, ou en creer un. */
@Component({
  selector: 'app-evenements',
  imports: [RouterLink],
  templateUrl: './evenements.html',
  styleUrl: './evenements.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Evenements {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly evenements = signal<EvenementResume[]>([]);
  protected readonly chargement = signal(true);
  protected readonly occupe = signal(false);
  protected readonly erreur = signal('');
  protected readonly nouveauNom = signal('');

  protected readonly prenom = this.session.session()?.prenom ?? '';

  constructor() {
    void this.rafraichir();
  }

  protected async rafraichir(): Promise<void> {
    this.chargement.set(true);
    try {
      this.evenements.set(await this.api.listerEvenements());
      this.erreur.set('');
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Chargement impossible');
    } finally {
      this.chargement.set(false);
    }
  }

  protected majNom(evenement: Event): void {
    this.nouveauNom.set((evenement.target as HTMLInputElement).value);
  }

  protected async creer(): Promise<void> {
    if (this.occupe()) return;
    const nom = this.nouveauNom().trim();
    if (!nom) return this.erreur.set("Donne un nom a l'evenement.");

    this.occupe.set(true);
    this.erreur.set('');
    try {
      // La bibliotheque de profils est semee des la creation : personne
      // n'arrive devant une page blanche.
      const { code } = await this.api.creerEvenement({ ...partageInitial(this.prenom), nom });
      await this.router.navigate(['/e', code]);
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Creation impossible');
    } finally {
      this.occupe.set(false);
    }
  }

  protected async supprimer(resume: EvenementResume): Promise<void> {
    if (!confirm(`Supprimer « ${resume.nom} » et tout ce qu'il contient ?`)) return;
    try {
      await this.api.supprimerEvenement(resume.code);
      await this.rafraichir();
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Suppression impossible');
    }
  }

  protected async deconnecter(): Promise<void> {
    this.session.fermer();
    await this.router.navigate(['/']);
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
