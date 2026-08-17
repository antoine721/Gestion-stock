import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { Modale } from '../modale/modale';
import { Panneau } from '../panneau/panneau';
import { BOISSONS, BOISSON_PAR_ID, LIBELLE_FAMILLE, ORDRE_FAMILLE } from '../../domain/catalogue';
import { EMOJIS_PROFIL } from '../../domain/personnes-types';
import { fmtNombre } from '../../domain/format';
import { Boisson, PersonneType, ResumePersonneType } from '../../domain/models';

interface LigneConso {
  boisson: Boisson;
  verresParJour: number;
}

interface OptionBoisson {
  famille: string;
  boissons: Boisson[];
}

/**
 * La bibliotheque de profils, en tableau. Commune a l'evenement : chacun peut
 * reprendre, ajuster ou dupliquer ceux des autres plutot que de redecrire les
 * memes personnes. La creation passe par une modale, le reglage boisson par
 * boisson par le panneau lateral.
 */
@Component({
  selector: 'app-personnes-types',
  imports: [Modale, Panneau],
  templateUrl: './personnes-types.html',
  styleUrl: './personnes-types.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonnesTypes {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtNombre = fmtNombre;
  protected readonly emojis = EMOJIS_PROFIL;

  protected readonly groupes = computed<OptionBoisson[]>(() =>
    ORDRE_FAMILLE.map((famille) => ({
      famille: LIBELLE_FAMILLE[famille],
      boissons: BOISSONS.filter((x) => x.famille === famille),
    })).filter((x) => x.boissons.length > 0),
  );

  protected consommation(personneType: PersonneType): LigneConso[] {
    return personneType.consommation
      .map((x) => ({ boisson: BOISSON_PAR_ID.get(x.boissonId), verresParJour: x.verresParJour }))
      .filter((x): x is LigneConso => !!x.boisson)
      .sort((a, b) => b.verresParJour - a.verresParJour);
  }

  /** Resume lisible sur la ligne : « biere 6 · spritz 3 ». */
  protected apercu(personneType: PersonneType): string {
    const lignes = this.consommation(personneType);
    if (lignes.length === 0) return 'Ne boit rien';
    return (
      lignes
        .slice(0, 2)
        .map((x) => `${x.boisson.nom} ${fmtNombre(x.verresParJour)}`)
        .join(' · ') + (lignes.length > 2 ? ` · +${lignes.length - 2}` : '')
    );
  }

  // -- Creation --------------------------------------------------------------

  protected readonly creationOuverte = signal(false);
  protected readonly brouillon = signal({ nom: '', emoji: EMOJIS_PROFIL[0], description: '' });

  protected readonly creationInvalide = computed(() => this.brouillon().nom.trim() === '');

  protected ouvrirCreation(): void {
    this.brouillon.set({ nom: '', emoji: EMOJIS_PROFIL[0], description: '' });
    this.creationOuverte.set(true);
  }

  protected majBrouillon(
    patch: Partial<{ nom: string; emoji: string; description: string }>,
  ): void {
    this.brouillon.set({ ...this.brouillon(), ...patch });
  }

  protected creer(): void {
    const brouillon = this.brouillon();
    if (!brouillon.nom.trim()) return;
    const id = this.store.creerPersonneType();
    this.store.majPersonneType(id, {
      nom: brouillon.nom.trim(),
      emoji: brouillon.emoji,
      description: brouillon.description.trim(),
    });
    this.creationOuverte.set(false);
    // Le profil neuf s'ouvre : il reste a dire ce qu'il boit.
    this.detailId.set(id);
  }

  // -- Detail ----------------------------------------------------------------

  protected readonly detailId = signal('');

  protected readonly detail = computed(() =>
    this.store.resumePersonnesTypes().find((x) => x.personneType.id === this.detailId()),
  );

  protected dupliquer(personneTypeId: string): void {
    const id = this.store.dupliquerPersonneType(personneTypeId);
    if (id) this.detailId.set(id);
  }

  protected supprimer(resume: ResumePersonneType): void {
    const suite =
      resume.effectif > 0
        ? ` ${resume.effectif} invite(s) y sont rattaches et seront retires.`
        : '';
    if (confirm(`Supprimer le profil « ${resume.personneType.nom} » ?${suite}`)) {
      this.store.supprimerPersonneType(resume.personneType.id);
      this.detailId.set('');
    }
  }

  protected majNom(personneTypeId: string, valeur: string): void {
    if (valeur.trim()) this.store.majPersonneType(personneTypeId, { nom: valeur.trim() });
  }

  protected majDescription(personneTypeId: string, valeur: string): void {
    this.store.majPersonneType(personneTypeId, { description: valeur });
  }

  protected majEmoji(personneTypeId: string, emoji: string): void {
    this.store.majPersonneType(personneTypeId, { emoji });
  }

  protected majVerres(personneTypeId: string, boissonId: string, valeur: string): void {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre)) this.store.majConsommation(personneTypeId, boissonId, nombre);
  }

  protected ajouterBoisson(personneTypeId: string, evenement: Event): void {
    const select = evenement.target as HTMLSelectElement;
    if (select.value) this.store.majConsommation(personneTypeId, select.value, 1);
    select.value = '';
  }

  protected dejaChoisie(personneType: PersonneType, boissonId: string): boolean {
    return personneType.consommation.some((x) => x.boissonId === boissonId);
  }
}
