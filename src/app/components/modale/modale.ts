import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

/**
 * La modale centree : celle qui sert a CREER. Elle est volontairement courte
 * — juste ce qu'il faut pour poser une ligne — et le detail complet se
 * modifie ensuite dans le panneau lateral.
 *
 * Le contenu est projete : chaque section fournit son propre formulaire, la
 * modale ne s'occupe que du cadre, du voile et des touches clavier.
 */
@Component({
  selector: 'app-modale',
  templateUrl: './modale.html',
  styleUrl: './modale.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modale {
  readonly titre = input('');
  readonly sousTitre = input('');
  readonly libelleValider = input('Creer');
  /** Grise le bouton principal tant que la saisie minimale manque. */
  readonly valideDesactive = input(false);

  readonly fermee = output<void>();
  readonly validee = output<void>();

  @HostListener('document:keydown.escape')
  protected surEchap(): void {
    this.fermee.emit();
  }
}
