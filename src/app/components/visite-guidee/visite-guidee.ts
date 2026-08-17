import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  output,
  signal,
} from '@angular/core';

interface EtapeVisite {
  /** Selecteur CSS de l'element a eclairer ; introuvable = etape sautee. */
  cible: string;
  titre: string;
  texte: string;
}

/** Le cadre lumineux qui suit l'element vise, en coordonnees de viewport. */
interface CadreVisite {
  haut: number;
  gauche: number;
  largeur: number;
  hauteur: number;
}

const ETAPES: EtapeVisite[] = [
  {
    cible: '.marque',
    titre: 'Bienvenue sur Vialcrm',
    texte:
      "Ton evenement vit ici. Le code se partage d'un clic : c'est lui que tes co-organisateurs utilisent pour te rejoindre.",
  },
  {
    cible: '.budget',
    titre: "L'addition, toujours sous les yeux",
    texte:
      'Le budget global et le cout par personne se recalculent a chaque saisie, ou que tu sois dans l’app.',
  },
  {
    cible: '.espaces',
    titre: 'Une piece par sujet',
    texte:
      'Bar, cuisine, invites, materiel, courses, planning, DJ… Chaque espace gere un sujet, et le petit chiffre a droite en donne l’etat.',
  },
  {
    cible: '.kpis',
    titre: 'Les chiffres du jour',
    texte:
      "L'accueil resume ce qui compte : budget, encaissements, invites et missions. Clique sur une carte pour ouvrir le detail.",
  },
  {
    cible: '.parcours-carte',
    titre: 'Le parcours de tes invites',
    texte:
      'De la fiche creee au paiement recu : tu vois ou ca bloque, et le conseil dessous te dit quoi faire.',
  },
  {
    cible: '.pied',
    titre: 'A toi de jouer',
    texte:
      'Ici tu passes en sombre, tu relances cette visite avec le « ? », et tu quittes l’evenement. Bon festival !',
  },
];

/**
 * La visite guidee maison : un voile sombre, un cadre lumineux qui suit
 * l'element vise, et une bulle qui explique. Aucune dependance externe —
 * le spotlight est un simple box-shadow geant autour du cadre.
 */
@Component({
  selector: 'app-visite-guidee',
  templateUrl: './visite-guidee.html',
  styleUrl: './visite-guidee.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisiteGuidee implements OnInit, OnDestroy {
  readonly fermee = output<void>();

  protected readonly etapes = ETAPES;
  protected readonly index = signal(0);
  protected readonly cadre = signal<CadreVisite | undefined>(undefined);

  protected readonly etape = computed(() => ETAPES[this.index()]);
  protected readonly derniere = computed(() => this.index() === ETAPES.length - 1);

  /** La bulle se pose sous le cadre, ou au-dessus s'il n'y a plus de place. */
  protected readonly bulle = computed(() => {
    const cadre = this.cadre();
    if (!cadre) return { haut: '50%', gauche: '50%' };
    const sous = cadre.haut + cadre.hauteur + 14;
    const haut = sous + 190 < window.innerHeight ? sous : Math.max(12, cadre.haut - 204);
    const gauche = Math.min(Math.max(12, cadre.gauche), window.innerWidth - 332);
    return { haut: `${haut}px`, gauche: `${gauche}px` };
  });

  private readonly remesurer = () => this.mesurer();

  ngOnInit(): void {
    this.mesurer();
    window.addEventListener('resize', this.remesurer);
    window.addEventListener('scroll', this.remesurer, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.remesurer);
    window.removeEventListener('scroll', this.remesurer, true);
  }

  protected aller(depuis: number, sens: 1 | -1): void {
    const suivant = depuis + sens;
    if (suivant < 0 || suivant >= ETAPES.length) return this.terminer();
    this.index.set(suivant);
    const cible = document.querySelector(ETAPES[suivant].cible);
    cible?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // On mesure apres le defilement : le cadre atterrit au bon endroit.
    setTimeout(() => this.mesurer(), 320);
  }

  protected terminer(): void {
    this.fermee.emit();
  }

  private mesurer(): void {
    const cible = document.querySelector(this.etape().cible);
    if (!cible) {
      this.cadre.set(undefined);
      return;
    }
    const boite = cible.getBoundingClientRect();
    this.cadre.set({
      haut: boite.top - 6,
      gauche: boite.left - 6,
      largeur: boite.width + 12,
      hauteur: boite.height + 12,
    });
  }
}
