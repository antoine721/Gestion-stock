import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Api, ErreurApi } from '../../state/api';
import { SessionStore } from '../../state/session';
import { Logo } from '../../components/logo/logo';

/** Un compte Google, et c'est tout. Le mot de passe commun reste en secours. */
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
  private readonly route = inject(ActivatedRoute);

  protected readonly prenom = signal('');
  protected readonly motDePasse = signal('');
  protected readonly occupe = signal(false);
  protected readonly erreur = signal('');
  /** Le repli mot de passe reste plie tant qu'on ne le demande pas. */
  protected readonly repli = signal(false);

  /** La page qu'on voulait avant d'etre renvoye ici : un lien /e/CODE partage, souvent. */
  private readonly retour = chemin(this.route.snapshot.queryParamMap.get('retour'));

  protected readonly lienGoogle = `/api/auth/google?retour=${encodeURIComponent(this.retour)}`;

  constructor() {
    // Le serveur renvoie ici avec son message quand Google refuse.
    this.erreur.set(this.route.snapshot.queryParamMap.get('erreur') ?? '');
    void this.reprendre();
  }

  protected majTexte(cible: ReturnType<typeof signal<string>>, evenement: Event): void {
    cible.set((evenement.target as HTMLInputElement).value);
  }

  protected ouvrirRepli(): void {
    this.repli.set(true);
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
      await this.router.navigateByUrl(this.retour);
    } catch (erreur) {
      this.erreur.set(message(erreur));
    } finally {
      this.occupe.set(false);
    }
  }

  /** Le cookie de session peut deja etre bon : inutile de refaire le tour de Google. */
  private async reprendre(): Promise<void> {
    if (await this.session.restaurer()) await this.router.navigateByUrl(this.retour);
  }
}

function chemin(valeur: string | null): string {
  return valeur?.startsWith('/') && !valeur.startsWith('//') ? valeur : '/evenements';
}

function message(erreur: unknown): string {
  if (erreur instanceof ErreurApi && erreur.statut === 401) return 'Mot de passe incorrect.';
  return erreur instanceof Error ? erreur.message : 'Connexion impossible';
}
