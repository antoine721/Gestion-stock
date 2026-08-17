import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Panneau } from '../panneau/panneau';
import { BOISSON_PAR_ID } from '../../domain/catalogue';
import { aDeclareQuelqueChose, interpreter } from '../../domain/interpretation';
import {
  FAMILLES_ALCOOL,
  LIBELLE_NIVEAU,
  LIBELLE_TEAM,
  libelleBoissonsAimees,
} from '../../domain/preferences';
import { fmtEntier, fmtNombre } from '../../domain/format';
import { Invite } from '../../domain/models';

/**
 * L'interpretation des declarations du formulaire.
 *
 * Chaque invite qui a rempli ses gouts se voit traduit en verres par jour,
 * puis rapproche du profil de consommation le plus proche. Un clic valide la
 * proposition ; sinon on reevalue a la main, profil par profil.
 *
 * C'est une aide a la decision, jamais une decision : rien ne s'applique sans
 * le clic, et les estimations douteuses (trop basses, trop hautes,
 * incoherentes avec l'equipe declaree) sont signalees avant d'etre validees.
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

  /** Ne montrer que ceux qui n'ont pas encore de profil, par defaut. */
  protected readonly seulementSansProfil = signal(true);

  /** Les fiches qui ont declare quelque chose, avec leur interpretation. */
  protected readonly lignes = computed(() => {
    const profils = this.store.personnesTypes();
    return this.store
      .invitesNommes()
      .filter(aDeclareQuelqueChose)
      .filter((x) => !this.seulementSansProfil() || !x.personneTypeId)
      .map((invite) => ({ invite, resultat: interpreter(invite, profils) }));
  });

  protected readonly aTraiter = computed(
    () => this.lignes().filter((x) => !x.invite.personneTypeId).length,
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

  protected profilActuel(invite: Invite): string {
    const profil = this.store.personnesTypes().find((x) => x.id === invite.personneTypeId);
    return profil ? `${profil.emoji} ${profil.nom}` : '';
  }

  /** Valider : le profil propose devient celui de la fiche. */
  protected validerProfil(invite: Invite, personneTypeId: string): void {
    this.store.majInvite(invite.id, { personneTypeId });
    if (this.detailId() === invite.id) this.detailId.set('');
  }

  /**
   * Reevaluer : on cree un profil taille sur mesure pour cette personne, a
   * partir de l'estimation. Utile quand personne dans la bibliotheque ne
   * ressemble a ce qu'elle a declare.
   */
  protected creerProfilSurMesure(invite: Invite): void {
    const resultat = interpreter(invite, this.store.personnesTypes());
    if (resultat.consommation.length === 0) return;
    const id = this.store.creerPersonneType();
    this.store.majPersonneType(id, {
      nom: `Comme ${invite.prenom || 'cet invite'}`,
      description: `Cree depuis la declaration de ${this.nomComplet(invite)}.`,
      emoji: '🍹',
    });
    for (const ligne of resultat.consommation) {
      this.store.majConsommation(id, ligne.boissonId, ligne.verresParJour);
    }
    this.store.majInvite(invite.id, { personneTypeId: id });
    this.detailId.set('');
  }

  // -- Le panneau de reevaluation --------------------------------------------

  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.lignes().find((x) => x.invite.id === this.detailId()),
  );
}
