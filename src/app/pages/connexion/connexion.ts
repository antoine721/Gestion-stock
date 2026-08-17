import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../state/api';
import { SessionStore } from '../../state/session';
import { Logo } from '../../components/logo/logo';

/** Le mot de passe commun et ton prenom. C'est tout. */
@Component({
  selector: 'app-connexion',
  imports: [Logo],
  templateUrl: './connexion.html',
  styleUrl: './connexion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Connexion {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly prenom = signal('');
  protected readonly motDePasse = signal('');
  protected readonly occupe = signal(false);
  protected readonly erreur = signal('');

  protected majTexte(cible: ReturnType<typeof signal<string>>, evenement: Event): void {
    cible.set((evenement.target as HTMLInputElement).value);
  }

  protected async entrer(): Promise<void> {
    if (this.occupe()) return;
    const prenom = this.prenom().trim();
    const motDePasse = this.motDePasse();

    if (!prenom) return this.erreur.set('Dis-moi ton prenom.');
    if (!motDePasse) return this.erreur.set('Il me faut le mot de passe.');

    this.occupe.set(true);
    this.erreur.set('');
    try {
      await this.api.verifier(motDePasse);
      this.session.ouvrir({ motDePasse, prenom });
      await this.router.navigate(['/evenements']);
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Connexion impossible');
    } finally {
      this.occupe.set(false);
    }
  }
}
