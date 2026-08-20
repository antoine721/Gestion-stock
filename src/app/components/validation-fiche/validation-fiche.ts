import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { ConsommationType, Invite, ReponseFormulaire } from '../../domain/models';
import { interpreter } from '../../domain/interpretation';
import { LIBELLE_REGIME, normaliserInvite } from '../../domain/invites';
import {
  FAMILLES_ALCOOL,
  LIBELLE_NIVEAU,
  libelleBoissonsAimees,
  libelleGoodies,
  libelleServices,
  LIBELLE_TEAM,
} from '../../domain/preferences';
import { BOISSON_PAR_ID } from '../../domain/catalogue';
import { fmtNombre } from '../../domain/format';

interface Etape {
  id: string;
  titre: string;
}

const ETAPES: readonly Etape[] = [
  { id: 'qui', titre: 'Qui est-ce ?' },
  { id: 'sejour', titre: 'Son sejour' },
  { id: 'alcool', titre: 'Sa consommation' },
  { id: 'coup-de-main', titre: 'Ce qu’il apporte' },
];

/**
 * La relecture d'une fiche, etape par etape.
 *
 * Une reponse au formulaire n'entre pas dans l'evenement toute seule : on la
 * relit, on corrige ce qui cloche, et c'est en validant la derniere etape
 * qu'on cree l'invite. L'etape qui compte est celle de la consommation —
 * c'est elle qui part dans les courses, et elle se corrige ici avant d'y
 * partir.
 */
@Component({
  selector: 'app-validation-fiche',
  imports: [Modale],
  templateUrl: './validation-fiche.html',
  styleUrl: './validation-fiche.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationFiche {
  protected readonly store = inject(PlannerStore);

  readonly reponse = input.required<ReponseFormulaire>();
  readonly fermee = output<void>();

  protected readonly fmtNombre = fmtNombre;
  protected readonly etapes = ETAPES;
  protected readonly familles = FAMILLES_ALCOOL;
  protected readonly libelleBoissonsAimees = libelleBoissonsAimees;
  protected readonly libelleServices = libelleServices;
  protected readonly libelleGoodies = libelleGoodies;

  protected readonly index = signal(0);
  protected readonly etape = computed(() => ETAPES[this.index()]);
  protected readonly derniere = computed(() => this.index() === ETAPES.length - 1);

  /** Qui l'amene : le premier co-organisateur par defaut, corrigeable. */
  protected readonly porteurId = signal('');
  /** La consommation relue, en verres par jour et par boisson. */
  protected readonly consommation = signal<ConsommationType[]>([]);
  /** L'organisateur a relu la consommation et la trouve juste. */
  protected readonly consoValidee = signal(false);

  /** La fiche telle qu'elle sera, pour faire tourner l'interpretation dessus. */
  private readonly inviteProvisoire = computed<Invite>(() =>
    normaliserInvite({
      id: 'provisoire',
      participantId: this.porteurId(),
      prenom: this.reponse().prenom,
      nom: this.reponse().nom,
      regime: this.reponse().regime,
      allergies: this.reponse().allergies,
      logistique: this.reponse().logistique,
      boissonsAimees: this.reponse().boissonsAimees,
      niveaux: this.reponse().niveaux,
      verresParFamille: this.reponse().verresParFamille,
      team: this.reponse().team,
    }),
  );

  protected readonly resultat = computed(() => interpreter(this.inviteProvisoire()));

  protected readonly totalVerres = computed(() =>
    this.consommation().reduce((somme, x) => somme + x.verresParJour, 0),
  );

  constructor() {
    queueMicrotask(() => {
      this.porteurId.set(this.reponse().invitParId || (this.store.participants()[0]?.id ?? ''));
      this.consommation.set(this.resultat().consommation.map((x) => ({ ...x })));
    });
  }

  protected nomComplet(): string {
    return `${this.reponse().prenom} ${this.reponse().nom}`.trim();
  }

  protected libelleRegime(): string {
    return LIBELLE_REGIME[this.reponse().regime] ?? '';
  }

  protected libelleTeam(): string {
    const team = this.reponse().team;
    return team ? (LIBELLE_TEAM.get(team) ?? '') : 'Pas declaree';
  }

  protected libelleRythme(): string {
    return FAMILLES_ALCOOL.map(
      (x) =>
        `${x.libelle.replace('Les ', '')} : ${(LIBELLE_NIVEAU.get(this.reponse().niveaux[x.id]) ?? '').toLowerCase()}`,
    ).join(' · ');
  }

  protected nomBoisson(boissonId: string): string {
    return BOISSON_PAR_ID.get(boissonId)?.nom ?? boissonId;
  }

  protected majVerres(boissonId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre)) return;
    this.consommation.set(
      this.consommation().map((x) =>
        x.boissonId === boissonId ? { ...x, verresParJour: Math.max(0, nombre) } : x,
      ),
    );
    // Une valeur corrigee demande une nouvelle relecture : on ne valide pas
    // une consommation qu'on vient de changer sans la regarder.
    this.consoValidee.set(false);
  }

  protected majPorteur(participantId: string): void {
    this.porteurId.set(participantId);
  }

  /** Le bouton principal reste gris tant que l'etape n'est pas reglee. */
  protected readonly bloquee = computed(() => {
    if (this.etape().id === 'qui') return this.porteurId() === '';
    if (this.etape().id === 'alcool') return !this.consoValidee();
    return false;
  });

  protected readonly libelleValider = computed(() =>
    this.derniere() ? "Ajouter l'invite" : 'Suivant',
  );

  protected precedent(): void {
    this.index.set(Math.max(0, this.index() - 1));
  }

  protected suivant(): void {
    if (this.bloquee()) return;
    if (!this.derniere()) {
      this.index.set(this.index() + 1);
      return;
    }
    this.store.validerFiche(this.reponse().id, this.porteurId(), this.consommation());
    this.fermee.emit();
  }
}
