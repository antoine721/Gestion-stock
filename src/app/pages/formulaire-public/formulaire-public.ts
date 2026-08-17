import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Api, InfosPubliques } from '../../state/api';
import { REGIMES } from '../../domain/invites';
import { BOISSONS, LIBELLE_FAMILLE, ORDRE_FAMILLE } from '../../domain/catalogue';
import { Regime } from '../../domain/models';

/**
 * La page publique du formulaire : le seul ecran de l'app accessible sans mot
 * de passe. L'invite s'identifie d'abord (c'est la seule chose obligatoire),
 * puis remplit le reste de sa fiche. La reponse part directement en base ;
 * les organisateurs la rattacheront a un co-organisateur depuis le hub.
 */
@Component({
  selector: 'app-formulaire-public',
  templateUrl: './formulaire-public.html',
  styleUrl: './formulaire-public.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormulairePublic {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);

  protected readonly regimes = REGIMES;
  protected readonly code = computed(() => this.route.snapshot.paramMap.get('code') ?? '');

  /** Le catalogue des boissons, groupe par famille, pour la conso declaree. */
  protected readonly familles = ORDRE_FAMILLE.map((famille) => ({
    libelle: LIBELLE_FAMILLE[famille],
    boissons: BOISSONS.filter((x) => x.famille === famille),
  })).filter((x) => x.boissons.length > 0);

  protected readonly infos = signal<InfosPubliques | undefined>(undefined);
  protected readonly introuvable = signal(false);
  protected readonly etape = signal<'identite' | 'fiche' | 'merci'>('identite');
  protected readonly envoiEnCours = signal(false);
  protected readonly erreur = signal('');

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

  /** boissonId -> verres par jour declares. Indicatif, jamais un bareme. */
  protected readonly consommations = signal<ReadonlyMap<string, number>>(new Map());

  protected readonly identiteValide = computed(() => this.prenom().trim().length > 0);

  protected verresDe(boissonId: string): number {
    return this.consommations().get(boissonId) ?? 0;
  }

  protected majVerres(boissonId: string, valeur: string): void {
    const verres = Number(valeur);
    if (!Number.isFinite(verres)) return;
    const suivantes = new Map(this.consommations());
    if (verres > 0) suivantes.set(boissonId, Math.min(30, verres));
    else suivantes.delete(boissonId);
    this.consommations.set(suivantes);
  }

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      this.infos.set(await this.api.chargerInfosPubliques(this.code()));
    } catch {
      this.introuvable.set(true);
    }
  }

  protected continuer(): void {
    if (this.identiteValide()) this.etape.set('fiche');
  }

  protected majAccompagnants(valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.accompagnants.set(Math.max(0, Math.round(nombre)));
  }

  protected async envoyer(): Promise<void> {
    if (!this.identiteValide() || this.envoiEnCours()) return;
    this.envoiEnCours.set(true);
    this.erreur.set('');
    try {
      await this.api.envoyerReponsePublique(this.code(), {
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
        consommations: [...this.consommations().entries()].map(([boissonId, verresParJour]) => ({
          boissonId,
          verresParJour,
        })),
      });
      this.etape.set('merci');
    } catch (erreur) {
      this.erreur.set(erreur instanceof Error ? erreur.message : 'Envoi impossible, reessaie');
    } finally {
      this.envoiEnCours.set(false);
    }
  }

  /** Une deuxieme fiche pour le conjoint ou le pote : on repart de zero. */
  protected recommencer(): void {
    this.prenom.set('');
    this.nom.set('');
    this.accompagnants.set(0);
    this.regime.set('omnivore');
    this.allergies.set('');
    this.preferencesBoissons.set('');
    this.envies.set('');
    this.recommandations.set('');
    this.commentaire.set('');
    this.consommations.set(new Map());
    this.etape.set('identite');
  }
}
