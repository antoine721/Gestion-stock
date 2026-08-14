import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
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
 * La bibliotheque de profils, en grille de vignettes. Commune a l'evenement :
 * chacun peut reprendre, ajuster ou dupliquer ceux des autres plutot que de
 * redecrire les memes personnes.
 */
@Component({
  selector: 'app-personnes-types',
  templateUrl: './personnes-types.html',
  styleUrl: './personnes-types.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonnesTypes {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtNombre = fmtNombre;
  protected readonly emojis = EMOJIS_PROFIL;

  /** Le profil ouvert en edition, un seul a la fois. */
  protected readonly ouvert = signal('');

  protected readonly groupes = computed<OptionBoisson[]>(() =>
    ORDRE_FAMILLE.map((famille) => ({
      famille: LIBELLE_FAMILLE[famille],
      boissons: BOISSONS.filter((x) => x.famille === famille),
    })).filter((x) => x.boissons.length > 0),
  );

  protected readonly enEdition = computed(() =>
    this.store.resumePersonnesTypes().find((x) => x.personneType.id === this.ouvert()),
  );

  protected consommation(personneType: PersonneType): LigneConso[] {
    return personneType.consommation
      .map((x) => ({ boisson: BOISSON_PAR_ID.get(x.boissonId), verresParJour: x.verresParJour }))
      .filter((x): x is LigneConso => !!x.boisson)
      .sort((a, b) => b.verresParJour - a.verresParJour);
  }

  /** Resume lisible sur la vignette : « biere 6 · spritz 3 ». */
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

  protected ouvrir(personneTypeId: string): void {
    this.ouvert.set(personneTypeId);
  }

  protected fermer(): void {
    this.ouvert.set('');
  }

  protected creer(): void {
    this.ouvert.set(this.store.creerPersonneType());
  }

  protected dupliquer(personneTypeId: string): void {
    const id = this.store.dupliquerPersonneType(personneTypeId);
    if (id) this.ouvert.set(id);
  }

  protected supprimer(resume: ResumePersonneType): void {
    const suite =
      resume.effectif > 0
        ? ` ${resume.effectif} invite(s) y sont rattaches et seront retires.`
        : '';
    if (confirm(`Supprimer le profil « ${resume.personneType.nom} » ?${suite}`)) {
      this.store.supprimerPersonneType(resume.personneType.id);
      this.fermer();
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
