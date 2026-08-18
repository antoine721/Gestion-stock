import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Api, InfosPubliques } from '../../state/api';
import { REGIMES, logistiqueVierge, niveauxVierges } from '../../domain/invites';
import {
  FAMILLES_ALCOOL,
  GOODIES,
  INTENSITE_MAX,
  LIBELLE_INTENSITE,
  PALIERS_CONSO,
  SERVICES,
  TEAMS,
  boissonsDeFamille,
} from '../../domain/preferences';
import {
  FamilleAlcool,
  NiveauConso,
  NiveauxParFamille,
  Regime,
  TeamBuveur,
} from '../../domain/models';
import { Logo } from '../../components/logo/logo';

/**
 * La page publique du formulaire : le seul ecran de l'app accessible sans mot
 * de passe. L'invite s'identifie d'abord (c'est la seule chose obligatoire),
 * puis remplit sa fiche en trois etapes courtes. La reponse part directement
 * en base ; les organisateurs la rattacheront a un co-organisateur depuis le
 * hub.
 *
 * Ce qu'on demande sur la boisson est DECLARATIF : ca oriente le choix du
 * profil de consommation, ca n'entre jamais tout seul dans le calcul.
 */
@Component({
  selector: 'app-formulaire-public',
  imports: [Logo],
  templateUrl: './formulaire-public.html',
  styleUrl: './formulaire-public.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormulairePublic {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);

  protected readonly regimes = REGIMES;
  protected readonly paliers = PALIERS_CONSO;
  protected readonly intensiteMax = INTENSITE_MAX;
  protected readonly teams = TEAMS;
  protected readonly services = SERVICES;
  protected readonly goodiesCatalogue = GOODIES;
  /** Les trois blocs d'alcool, chacun avec ses boissons et sa question. */
  protected readonly familles = FAMILLES_ALCOOL.map((famille) => ({
    ...famille,
    boissons: boissonsDeFamille(famille.id),
  }));

  protected readonly code = computed(() => this.route.snapshot.paramMap.get('code') ?? '');
  protected readonly infos = signal<InfosPubliques | undefined>(undefined);
  protected readonly introuvable = signal(false);
  protected readonly envoiEnCours = signal(false);
  protected readonly erreur = signal('');

  /** Le formulaire se traverse en trois etapes, puis un remerciement. */
  protected readonly etape = signal<'identite' | 'sejour' | 'gouts' | 'merci'>('identite');

  // -- Qui es-tu ------------------------------------------------------------

  protected readonly prenom = signal('');
  protected readonly nom = signal('');
  protected readonly surnom = signal('');
  /** L'identifiant du co-organisateur coche, pas son prenom : c'est lui qui
      recuperera la fiche sans qu'on ait a rapprocher deux orthographes. */
  protected readonly invitParId = signal('');

  /** Les co-organisateurs a cocher. Vide tant que les infos ne sont pas la. */
  protected readonly organisateurs = computed(() => this.infos()?.organisateurs ?? []);

  // -- Ton sejour -----------------------------------------------------------

  protected readonly sejourComplet = signal<'' | 'oui' | 'non'>('');
  protected readonly arrivee = signal('');
  protected readonly depart = signal('');
  protected readonly voiture = signal<'' | 'oui' | 'non'>('');
  protected readonly permis = signal<'' | 'oui' | 'non'>('');
  protected readonly tente = signal<'' | 'oui' | 'non'>('');
  protected readonly placesVoiture = signal(0);
  protected readonly chercheCovoiturage = signal(false);

  // -- Tes gouts ------------------------------------------------------------

  protected readonly regime = signal<Regime>('omnivore');
  protected readonly aDesAllergies = signal<'' | 'non' | 'oui'>('');
  protected readonly allergies = signal('');
  /** boissonId -> cran du curseur, de 0 (« j'en bois pas ») a 4. */
  protected readonly boissonsAimees = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly niveaux = signal<NiveauxParFamille>(niveauxVierges());
  protected readonly autreAlcool = signal('');
  protected readonly team = signal<TeamBuveur | ''>('');
  protected readonly servicesPreferes = signal<ReadonlySet<string>>(new Set());
  protected readonly goodies = signal<ReadonlySet<string>>(new Set());
  protected readonly goodiesAutre = signal('');
  protected readonly materielApporte = signal('');
  protected readonly besoins = signal('');
  protected readonly commentaire = signal('');
  protected readonly stylesMusicaux = signal('');

  /** « Du ven. 21 aout au dim. 23 aout · La prairie du moulin ». */
  protected readonly quandOu = computed(() => {
    const infos = this.infos();
    if (!infos) return '';
    const format = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
    const date = (iso?: string) =>
      iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? format.format(new Date(`${iso}T00:00:00`)) : '';
    const debut = date(infos.debut);
    const fin = date(infos.fin);
    const quand = debut && fin && fin !== debut ? `Du ${debut} au ${fin}` : debut;
    return [quand, infos.lieu].filter(Boolean).join(' · ');
  });

  // -- Validation : une etape ne se quitte pas incomplete -------------------

  protected readonly identiteValide = computed(() => {
    if (!this.prenom().trim() || !this.nom().trim()) return false;
    // Designer son hote est obligatoire — sauf si l'evenement n'a encore aucun
    // co-organisateur a proposer, auquel cas il n'y a rien a cocher.
    return this.organisateurs().length === 0 || this.invitParId() !== '';
  });

  protected readonly sejourValide = computed(() => {
    if (this.sejourComplet() === '') return false;
    // Sejour partiel : on veut savoir quand la personne arrive et repart.
    if (this.sejourComplet() === 'non') {
      if (!this.arrivee().trim() || !this.depart().trim()) return false;
    }
    return this.voiture() !== '' && this.permis() !== '' && this.tente() !== '';
  });

  protected readonly goutsValides = computed(() => {
    if (this.aDesAllergies() === '') return false;
    if (this.aDesAllergies() === 'oui' && !this.allergies().trim()) return false;
    if (this.team() === '') return false;
    return this.materielApporte().trim().length > 0;
  });

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

  // -- Navigation entre etapes ----------------------------------------------

  protected allerSejour(): void {
    if (this.identiteValide()) this.etape.set('sejour');
  }

  protected allerGouts(): void {
    if (this.sejourValide()) this.etape.set('gouts');
  }

  protected revenir(vers: 'identite' | 'sejour'): void {
    this.etape.set(vers);
  }

  // -- Petits utilitaires de saisie -----------------------------------------

  protected majPlacesVoiture(valeur: string): void {
    const places = Number(valeur);
    if (Number.isFinite(places))
      this.placesVoiture.set(Math.min(9, Math.max(0, Math.round(places))));
  }

  protected intensiteDe(id: string): number {
    return this.boissonsAimees().get(id) ?? 0;
  }

  protected libelleIntensiteDe(id: string): string {
    return LIBELLE_INTENSITE.get(this.intensiteDe(id)) ?? '';
  }

  protected niveauDe(famille: FamilleAlcool): NiveauConso {
    return this.niveaux()[famille];
  }

  protected majNiveau(famille: FamilleAlcool, niveau: NiveauConso): void {
    this.niveaux.set({ ...this.niveaux(), [famille]: niveau });
  }

  /**
   * Le curseur bouge, le rythme de la famille suit.
   *
   * Passer un premier alcool au-dessus de zero alors qu'on est encore a « rien
   * du tout » n'a pas de sens, et retomber a zero partout laisse un rythme
   * declare sans rien pour le porter. On evite ainsi de faire remonter des
   * fiches contradictoires a l'interpretation.
   */
  protected majIntensite(id: string, famille: FamilleAlcool, valeur: string): void {
    const cran = Number(valeur);
    if (!Number.isFinite(cran)) return;
    const suivantes = new Map(this.boissonsAimees());
    suivantes.set(id, Math.min(INTENSITE_MAX, Math.max(0, Math.round(cran))));
    this.boissonsAimees.set(suivantes);

    const aimees = boissonsDeFamille(famille).some((x) => (suivantes.get(x.id) ?? 0) > 0);
    const niveau = this.niveaux()[famille];
    if (aimees && niveau === 'aucun') this.majNiveau(famille, 'moyen');
    else if (!aimees && niveau !== 'aucun') this.majNiveau(famille, 'aucun');
  }

  /** Le chameau ne repond pas aux questions d'alcool : elles disparaissent. */
  protected readonly sansAlcool = computed(() => this.team() === 'chameau');

  /** Le prenom de l'hote coche, garde en clair sur la reponse. */
  private nomOrganisateur(): string {
    return this.organisateurs().find((x) => x.id === this.invitParId())?.nom ?? '';
  }

  protected veutService(id: string): boolean {
    return this.servicesPreferes().has(id);
  }

  protected basculerService(id: string): void {
    const suivants = new Set(this.servicesPreferes());
    if (suivants.has(id)) suivants.delete(id);
    else suivants.add(id);
    this.servicesPreferes.set(suivants);
  }

  protected veutGoodie(id: string): boolean {
    return this.goodies().has(id);
  }

  protected basculerGoodie(id: string): void {
    const suivants = new Set(this.goodies());
    if (suivants.has(id)) suivants.delete(id);
    else suivants.add(id);
    this.goodies.set(suivants);
  }

  // -- Envoi -----------------------------------------------------------------

  protected async envoyer(): Promise<void> {
    if (!this.identiteValide() || !this.sejourValide() || !this.goutsValides()) return;
    if (this.envoiEnCours()) return;
    this.envoiEnCours.set(true);
    this.erreur.set('');

    const complet = this.sejourComplet() === 'oui';
    try {
      await this.api.envoyerReponsePublique(this.code(), {
        prenom: this.prenom().trim(),
        nom: this.nom().trim(),
        surnom: this.surnom().trim(),
        invitParId: this.invitParId(),
        invitePar: this.nomOrganisateur(),
        regime: this.regime(),
        allergies: this.aDesAllergies() === 'oui' ? this.allergies().trim() : '',
        commentaire: this.commentaire().trim(),
        stylesMusicaux: this.stylesMusicaux().trim(),
        // Qui ne boit pas n'a pas de profil alcool : ni gouts, ni rythme, ni
        // alcool oublie. Le vide est sa reponse, pas un trou a combler.
        boissonsAimees: this.sansAlcool()
          ? []
          : [...this.boissonsAimees().entries()]
              .filter(([, intensite]) => intensite > 0)
              .map(([boissonId, intensite]) => ({ boissonId, intensite })),
        niveaux: this.sansAlcool() ? niveauxVierges() : this.niveaux(),
        autreAlcool: this.sansAlcool() ? '' : this.autreAlcool().trim(),
        team: this.team(),
        servicesPreferes: [...this.servicesPreferes()],
        goodies: [...this.goodies()],
        goodiesAutre: this.goodiesAutre().trim(),
        logistique: {
          ...logistiqueVierge(),
          permis: this.permis() === 'oui',
          vehicule: this.voiture() === 'oui',
          tente: this.tente() === 'oui',
          sejourComplet: complet,
          placesVoiture: this.voiture() === 'oui' ? this.placesVoiture() : 0,
          chercheCovoiturage: this.chercheCovoiturage(),
          arrivee: complet ? '' : this.arrivee().trim(),
          depart: complet ? '' : this.depart().trim(),
          materielApporte: this.materielApporte().trim(),
          besoins: this.besoins().trim(),
        },
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
    this.surnom.set('');
    this.sejourComplet.set('');
    this.arrivee.set('');
    this.depart.set('');
    this.voiture.set('');
    this.permis.set('');
    this.tente.set('');
    this.placesVoiture.set(0);
    this.chercheCovoiturage.set(false);
    this.regime.set('omnivore');
    this.aDesAllergies.set('');
    this.allergies.set('');
    this.boissonsAimees.set(new Map());
    this.niveaux.set(niveauxVierges());
    this.autreAlcool.set('');
    this.team.set('');
    this.servicesPreferes.set(new Set());
    this.goodies.set(new Set());
    this.goodiesAutre.set('');
    this.materielApporte.set('');
    this.besoins.set('');
    this.commentaire.set('');
    this.stylesMusicaux.set('');
    this.etape.set('identite');
  }
}
