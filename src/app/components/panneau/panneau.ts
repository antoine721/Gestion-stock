import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

/**
 * Le panneau lateral : celui qui sert a DETAILLER. Il glisse depuis la
 * droite, garde le tableau visible derriere lui, et contient tout ce qu'on
 * ne met pas dans une ligne — champs longs, logistique, notes.
 *
 * Il n'a pas de bouton « enregistrer » : chaque champ ecrit dans le store au
 * fil de la frappe, comme partout ailleurs dans l'app.
 */
@Component({
  selector: 'app-panneau',
  templateUrl: './panneau.html',
  styleUrl: './panneau.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panneau {
  readonly titre = input('');
  readonly sousTitre = input('');
  /** Libelle de l'action destructrice du pied ; vide = pas de bouton. */
  readonly libelleSupprimer = input('');

  readonly fermee = output<void>();
  readonly supprimee = output<void>();

  @HostListener('document:keydown.escape')
  protected surEchap(): void {
    this.fermee.emit();
  }
}
