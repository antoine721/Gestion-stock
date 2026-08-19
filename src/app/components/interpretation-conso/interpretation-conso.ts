import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Panneau } from '../panneau/panneau';
import { BOISSON_PAR_ID } from '../../domain/catalogue';
import { alerterSurEstimation } from '../../domain/interpretation';
import {
  FAMILLES_ALCOOL,
  LIBELLE_NIVEAU,
  LIBELLE_TEAM,
  libelleBoissonsAimees,
} from '../../domain/preferences';
import { fmtEntier, fmtNombre } from '../../domain/format';
import { ConsommationType, Invite } from '../../domain/models';

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

  /** « Bieres moyen · vins peu » — le rythme declare, famille par famille. */
  protected rythme(invite: Invite): string {
    const dit = FAMILLES_ALCOOL.filter((x) => invite.niveaux[x.id] !== 'aucun');
    if (dit.length === 0) return 'Aucun rythme declare';
    return dit
      .map(
        (x) =>
          `${x.libelle.replace('Les ', '')} ${LIBELLE_NIVEAU.get(invite.niveaux[x.id])?.toLowerCase()}`,
      )
      .join(' · ');
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
