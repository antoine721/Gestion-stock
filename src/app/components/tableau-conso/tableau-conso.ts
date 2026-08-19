import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import {
  FAMILLES_ALCOOL,
  INTENSITE_MAX,
  LIBELLE_NIVEAU,
  PAS_INTENSITE,
  PALIERS_CONSO,
  alcoolPrefere,
  boissonsDeFamille,
} from '../../domain/preferences';
import { FamilleAlcool, GoutBoisson, Invite, NiveauConso } from '../../domain/models';
import { fmtEntier } from '../../domain/format';

/**
 * Le tableau des declarations : une ligne par invite, une colonne par alcool.
 *
 * C'est la contrepartie du formulaire. Le formulaire recueille, ce tableau
 * relit : on voit d'un coup qui boit quoi, on repere la reponse fantaisiste,
 * et on corrige la valeur sur place plutot que d'ouvrir quinze fiches.
 *
 * Les pourcentages sont ceux que la personne a poses elle-meme. Les corriger
 * ici corrige sa fiche, pas une copie.
 */
@Component({
  selector: 'app-tableau-conso',
  imports: [],
  templateUrl: './tableau-conso.html',
  styleUrl: './tableau-conso.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableauConso {
  protected readonly store = inject(PlannerStore);

  protected readonly fmtEntier = fmtEntier;
  protected readonly familles = FAMILLES_ALCOOL.map((famille) => ({
    ...famille,
    boissons: boissonsDeFamille(famille.id),
  }));
  protected readonly boissons = this.familles.flatMap((x) => x.boissons);
  protected readonly paliers = PALIERS_CONSO;
  protected readonly intensiteMax = INTENSITE_MAX;
  protected readonly pasIntensite = PAS_INTENSITE;

  /** Ne montrer que les fiches qui ont declare quelque chose : le reste est du vide. */
  protected readonly seulementDeclares = signal(false);

  protected readonly lignes = computed(() => {
    const invites = this.store.invitesNommes();
    return this.seulementDeclares()
      ? invites.filter((x) => x.boissonsAimees.some((g) => g.intensite > 0))
      : invites;
  });

  /** Combien de personnes declarent chaque boisson : la colonne du barman. */
  protected readonly amateurs = computed(() => {
    const total = new Map<string, number>();
    for (const invite of this.store.invitesNommes()) {
      for (const gout of invite.boissonsAimees) {
        if (gout.intensite > 0) total.set(gout.boissonId, (total.get(gout.boissonId) ?? 0) + 1);
      }
    }
    return total;
  });

  constructor() {
    // Arriver depuis une fiche doit poser l'oeil sur SA ligne.
    effect(() => {
      const cible = this.store.inviteEnAvant();
      if (!cible) return;
      queueMicrotask(() => {
        document
          .getElementById(`conso-${cible}`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      // Le surlignage a fait son travail une fois qu'on a trouve la ligne :
      // le laisser en place ferait croire a un etat particulier de la fiche.
      const minuteur = setTimeout(() => this.store.mettreEnAvant(''), 4000);
      return () => clearTimeout(minuteur);
    });
  }

  protected enAvant(invite: Invite): boolean {
    return this.store.inviteEnAvant() === invite.id;
  }

  protected nomComplet(invite: Invite): string {
    return `${invite.prenom || 'Sans prenom'} ${invite.nom}`.trim();
  }

  protected nomDuParticipant(participantId: string): string {
    return this.store.participants().find((x) => x.id === participantId)?.nom ?? '';
  }

  protected intensiteDe(invite: Invite, boissonId: string): number {
    return invite.boissonsAimees.find((x) => x.boissonId === boissonId)?.intensite ?? 0;
  }

  protected majIntensite(invite: Invite, boissonId: string, valeur: string): void {
    const brut = Number(valeur);
    if (!Number.isFinite(brut)) return;
    const part = Math.min(INTENSITE_MAX, Math.max(0, Math.round(brut)));
    // Un gout a zero ne se stocke pas : c'est l'absence qui veut dire « rien ».
    const restantes = invite.boissonsAimees.filter((x) => x.boissonId !== boissonId);
    const suivantes: GoutBoisson[] =
      part > 0 ? [...restantes, { boissonId, intensite: part }] : restantes;
    this.store.majInvite(invite.id, { boissonsAimees: suivantes });
  }

  protected niveauDe(invite: Invite, famille: FamilleAlcool): NiveauConso {
    return invite.niveaux[famille];
  }

  protected majNiveau(invite: Invite, famille: FamilleAlcool, valeur: string): void {
    if (!PALIERS_CONSO.some((x) => x.id === valeur)) return;
    this.store.majInvite(invite.id, {
      niveaux: { ...invite.niveaux, [famille]: valeur as NiveauConso },
    });
  }

  protected libelleNiveau(niveau: NiveauConso): string {
    return LIBELLE_NIVEAU.get(niveau) ?? '';
  }

  protected prefere(invite: Invite): string {
    const meilleur = alcoolPrefere(invite.boissonsAimees);
    return meilleur ? `${meilleur.libelle} · ${meilleur.part} %` : '';
  }
}
