import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Panneau } from '../panneau/panneau';
import { BOISSON_PAR_ID } from '../../domain/catalogue';
import { alerterSurEstimation } from '../../domain/interpretation';
import {
  FAMILLES_ALCOOL,
  LIBELLE_TEAM,
  PAS_GOUT,
  boissonsDeFamille,
  libelleBoissonsAimees,
  repartirGouts,
} from '../../domain/preferences';
import { fmtEntier, fmtNombre } from '../../domain/format';
import { ConsommationType, FamilleAlcool, Invite } from '../../domain/models';

/**
 * Les consommations des fiches validees.
 *
 * Chaque fiche entre dans l'evenement avec SA consommation, relue a la
 * validation. Cet ecran les met cote a cote : qui boit quoi, combien par
 * jour, et ce qui detonne. On y corrige un chiffre sans rouvrir la fiche.
 *
 * Il n'y a plus de bibliotheque de profils a entretenir : la consommation
 * d'une personne appartient a cette personne.
 */
@Component({
  selector: 'app-interpretation-conso',
  imports: [Panneau],
  templateUrl: './interpretation-conso.html',
  styleUrl: './interpretation-conso.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterpretationConso {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEntier = fmtEntier;
  protected readonly fmtNombre = fmtNombre;
  protected readonly libelleBoissonsAimees = libelleBoissonsAimees;
  protected readonly familles = FAMILLES_ALCOOL;
  protected readonly pasGout = PAS_GOUT;

  /** Masquer les fiches a zero : elles n'apprennent rien sur le bar. */
  protected readonly seulementBuveurs = signal(false);

  protected readonly lignes = computed(() => {
    const profils = this.store.personnesTypes();
    return this.store
      .invitesNommes()
      .map((invite) => {
        const consommation =
          profils.find((x) => x.id === invite.personneTypeId)?.consommation ?? [];
        const total = consommation.reduce((somme, x) => somme + x.verresParJour, 0);
        return {
          invite,
          consommation,
          total,
          alertes: alerterSurEstimation(invite, consommation),
        };
      })
      .filter((x) => !this.seulementBuveurs() || x.total > 0);
  });

  protected readonly totalGeneral = computed(() =>
    this.lignes().reduce((somme, x) => somme + x.total, 0),
  );

  protected readonly sansConsommation = computed(
    () => this.store.invitesNommes().filter((x) => !x.personneTypeId).length,
  );

  protected nomComplet(invite: Invite): string {
    const nom = `${invite.prenom} ${invite.nom}`.trim();
    return invite.surnom ? `${nom} « ${invite.surnom} »` : nom || 'Sans nom';
  }

  protected libelleTeam(invite: Invite): string {
    return invite.team ? (LIBELLE_TEAM.get(invite.team) ?? '') : '';
  }

  /** « 4 bieres · 2 vins » — ce qu'il a declare boire, famille par famille. */
  protected rythme(invite: Invite): string {
    const dit = FAMILLES_ALCOOL.filter((x) => (invite.verresParFamille[x.id] ?? 0) > 0);
    if (dit.length === 0) return 'Aucun verre declare';
    return dit
      .map((x) => `${fmtNombre(invite.verresParFamille[x.id])} ${x.libelle.replace('Les ', '')}`)
      .join(' · ');
  }

  // -- La declaration, corrigible : le meme formulaire que l'invite a rempli --

  protected verresDe(invite: Invite, famille: FamilleAlcool): number {
    return invite.verresParFamille[famille] ?? 0;
  }

  protected majVerresDe(invite: Invite, famille: FamilleAlcool, valeur: number): void {
    if (!Number.isFinite(valeur)) return;
    const verres = Math.min(30, Math.max(0, Math.round(valeur * 2) / 2));
    this.store.majDeclaration(invite.id, {
      verresParFamille: { ...invite.verresParFamille, [famille]: verres },
    });
  }

  protected partDe(invite: Invite, boissonId: string): number {
    return invite.boissonsAimees.find((x) => x.boissonId === boissonId)?.intensite ?? 0;
  }

  /** Les parts d'une famille font 100 % : ce qu'on donne a l'un se prend aux autres. */
  protected majPart(
    invite: Invite,
    famille: FamilleAlcool,
    boissonId: string,
    valeur: string,
  ): void {
    const brut = Number(valeur);
    if (!Number.isFinite(brut)) return;

    const ids = boissonsDeFamille(famille).map((x) => x.id);
    const actuelles = new Map(ids.map((id) => [id, this.partDe(invite, id)] as const));
    const gardees = invite.boissonsAimees.filter((x) => !ids.includes(x.boissonId));
    const refaites = [...repartirGouts(actuelles, boissonId, brut)]
      .filter(([, intensite]) => intensite > 0)
      .map(([id, intensite]) => ({ boissonId: id, intensite }));

    this.store.majDeclaration(invite.id, { boissonsAimees: [...gardees, ...refaites] });
  }

  protected boissonsDe(famille: FamilleAlcool) {
    return boissonsDeFamille(famille);
  }

  protected nomBoisson(boissonId: string): string {
    return BOISSON_PAR_ID.get(boissonId)?.nom ?? boissonId;
  }

  /** « 2 bieres · 1 rhum coca » — la consommation en une ligne. */
  protected resumeConso(consommation: readonly ConsommationType[]): string {
    return consommation
      .map((x) => `${fmtNombre(x.verresParJour)} ${this.nomBoisson(x.boissonId)}`)
      .join(' · ');
  }

  protected majVerres(invite: Invite, boissonId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre) || !invite.personneTypeId) return;
    this.store.majConsommation(invite.personneTypeId, boissonId, Math.max(0, nombre));
  }

  // -- Le panneau de correction ----------------------------------------------

  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.lignes().find((x) => x.invite.id === this.detailId()),
  );
}
