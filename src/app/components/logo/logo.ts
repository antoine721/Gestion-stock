import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * Le logo Vialcrm : l'icone puis le mot, ou le mot seul.
 *
 * L'icone est un fichier depose dans `public/logo-vialcrm.png`. Tant qu'il
 * n'est pas la, le composant n'affiche que le mot — jamais une image cassee.
 * Le mot, lui, est du texte : il reste net a toutes les tailles, suit le
 * theme, et se lit par les lecteurs d'ecran.
 */
@Component({
  selector: 'app-logo',
  templateUrl: './logo.html',
  styleUrl: './logo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  /** 'complet' = icone + mot ; 'mot' = le mot seul, pour la sidebar. */
  readonly variante = input<'complet' | 'mot'>('complet');

  /** L'icone a echoue (fichier absent) : on se rabat sur le mot seul. */
  protected readonly iconeAbsente = signal(false);
}
