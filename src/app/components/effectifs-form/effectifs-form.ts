import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { BOISSON_PAR_ID } from '../../domain/catalogue';
import { fmtNombre } from '../../domain/format';
import { PersonneType } from '../../domain/models';

/** Combien de personnes de chaque profil CE co-organisateur amene. */
@Component({
  selector: 'app-effectifs-form',
  templateUrl: './effectifs-form.html',
  styleUrl: './effectifs-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectifsForm {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtNombre = fmtNombre;

  protected readonly participant = computed(() => this.store.participantEdite());

  /** Les profils du plus utilise au moins utilise, ceux que j'amene en tete. */
  protected readonly lignes = computed(() =>
    this.store
      .personnesTypes()
      .map((personneType) => ({
        personneType,
        nombre: this.store.effectifDe(personneType.id),
        apercu: this.apercu(personneType),
      }))
      .sort((a, b) => b.nombre - a.nombre),
  );

  protected majNom(valeur: string): void {
    const participant = this.participant();
    if (participant && valeur.trim()) {
      this.store.majParticipant(participant.id, { nom: valeur.trim() });
    }
  }

  protected majNombre(personneTypeId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majEffectif(personneTypeId, nombre);
  }

  protected incrementer(personneTypeId: string, pas: number): void {
    this.store.majEffectif(personneTypeId, this.store.effectifDe(personneTypeId) + pas);
  }

  private apercu(personneType: PersonneType): string {
    if (personneType.consommation.length === 0) return 'Ne boit rien';
    return [...personneType.consommation]
      .sort((a, b) => b.verresParJour - a.verresParJour)
      .slice(0, 3)
      .map((x) => `${BOISSON_PAR_ID.get(x.boissonId)?.nom ?? '?'} ${fmtNombre(x.verresParJour)}`)
      .join(' · ');
  }
}
