import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ESPACES, Espace, PlannerStore } from '../../state/planner-store';
import { fmtEntier, fmtEuro } from '../../domain/format';

interface CarteHub {
  espace: Espace;
  libelle: string;
  emoji: string;
  teinte: string;
  /** Le chiffre qui resume la piece, en gros sur la card. */
  valeur: string;
  sous: string;
  /** '' = rien a signaler ; sinon le badge d'etat de la card. */
  etat: 'pret' | 'attention' | '';
  etatTexte: string;
}

/**
 * La page d'accueil du hub : une card par piece de l'evenement, avec le
 * chiffre qui la resume et ce qui y reste a faire. C'est le tableau de bord
 * qu'on montre aux co-organisateurs pour dire « voila ou on en est ».
 */
@Component({
  selector: 'app-hub-accueil',
  templateUrl: './hub-accueil.html',
  styleUrl: './hub-accueil.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubAccueil {
  protected readonly store = inject(PlannerStore);
  protected readonly fmtEuro = fmtEuro;
  protected readonly fmtEntier = fmtEntier;

  protected readonly cartes = computed<CarteHub[]>(() => {
    const infos = new Map(ESPACES.map((x) => [x.id, x]));
    const carte = (
      espace: Espace,
      reste: Omit<CarteHub, 'espace' | 'libelle' | 'emoji' | 'teinte'>,
    ): CarteHub => {
      const info = infos.get(espace);
      return {
        espace,
        libelle: info?.libelle ?? espace,
        emoji: info?.emoji ?? '',
        teinte: info?.teinte ?? 'ardoise',
        ...reste,
      };
    };

    const panier = this.store.panier();
    const alertes = this.store.alertes().length;
    const nourriture = this.store.budgetNourriture();
    const materiel = this.store.budgetMateriel();
    const invites = this.store.invitesNommes();
    const sansProfil = invites.filter((x) => !x.personneTypeId).length;
    const reponses = this.store.reponsesFormulaire().length;
    const encaissements = this.store.encaissements();
    const courses = this.store.resumeCourses();
    const programme = this.store.resumeProgramme();
    const dj = this.store.resumeDj();

    return [
      carte('alcool', {
        valeur: fmtEuro(panier.coutTotal),
        sous: `${fmtEntier(this.store.lignesCourses().length)} references · ${fmtEntier(panier.verresTotal)} verres`,
        etat: alertes > 0 ? 'attention' : 'pret',
        etatTexte: alertes > 0 ? `${alertes} alerte(s)` : 'Pret',
      }),
      carte('nourriture', {
        valeur: fmtEuro(nourriture.total),
        sous: `${fmtEntier(nourriture.repasPrevus)} repas prevus`,
        etat:
          nourriture.repasManquants > 0 ? 'attention' : nourriture.repasPrevus > 0 ? 'pret' : '',
        etatTexte:
          nourriture.repasManquants > 0
            ? `${nourriture.repasManquants} repas a decider`
            : nourriture.repasPrevus > 0
              ? 'Planifie'
              : '',
      }),
      carte('utilisateurs', {
        valeur: fmtEntier(invites.length),
        sous:
          encaissements.attendu > 0
            ? `${fmtEuro(encaissements.encaisse)} / ${fmtEuro(encaissements.attendu)} encaisses`
            : `${fmtEntier(this.store.cadre().invites)} tetes au total`,
        etat: encaissements.enAttente > 0 || sansProfil > 0 ? 'attention' : '',
        etatTexte:
          encaissements.enAttente > 0
            ? `${encaissements.enAttente} paiement(s) en attente`
            : sansProfil > 0
              ? `${sansProfil} sans profil`
              : '',
      }),
      carte('materiel', {
        valeur: fmtEuro(materiel.total),
        sous: `${fmtEntier(this.store.articles().length)} article(s) · achat & location`,
        etat: materiel.aPrevoir > 0 ? 'attention' : '',
        etatTexte: materiel.aPrevoir > 0 ? `${materiel.aPrevoir} a prevoir` : '',
      }),
      carte('courses', {
        valeur: fmtEuro(courses.restant),
        sous:
          courses.lignes > 0
            ? `reste a acheter · ${fmtEntier(courses.cochees)}/${fmtEntier(courses.lignes)} lignes cochees`
            : 'La liste se remplit toute seule',
        etat: courses.lignes > 0 && courses.restant === 0 ? 'pret' : '',
        etatTexte: courses.lignes > 0 && courses.restant === 0 ? 'Caddie plein' : '',
      }),
      carte('programme', {
        valeur: `${fmtEntier(programme.creneaux)} mission(s)`,
        sous:
          programme.sansAssigne > 0
            ? `${fmtEntier(programme.sansAssigne)} sans equipe`
            : 'Toutes les missions ont leur equipe',
        etat:
          programme.creneaux > 0 && (programme.joursVides > 0 || programme.sansAssigne > 0)
            ? 'attention'
            : programme.creneaux > 0
              ? 'pret'
              : '',
        etatTexte:
          programme.creneaux > 0 && programme.sansAssigne > 0
            ? `${programme.sansAssigne} a pourvoir`
            : programme.creneaux > 0 && programme.joursVides > 0
              ? `${programme.joursVides} jour(s) vide(s)`
              : programme.creneaux > 0
                ? 'Complet'
                : '',
      }),
      carte('dj', {
        valeur: `${fmtEntier(dj.valides)}/${fmtEntier(dj.total)} sets`,
        sous: 'valides sur le tableau horaire',
        etat: dj.demandes > 0 ? 'attention' : dj.valides > 0 ? 'pret' : '',
        etatTexte: dj.demandes > 0 ? `${dj.demandes} demande(s)` : dj.valides > 0 ? 'Cale' : '',
      }),
      carte('stats', {
        valeur: fmtEuro(this.store.budgetGlobal().total),
        sous: `${fmtEuro(this.store.budgetGlobal().parPersonne)} / personne`,
        etat: '',
        etatTexte: '',
      }),
      carte('formulaire', {
        valeur: fmtEntier(reponses),
        sous: reponses > 0 ? 'reponse(s) a rattacher' : 'A faire remplir par les invites',
        etat: reponses > 0 ? 'attention' : '',
        etatTexte: reponses > 0 ? 'A traiter' : '',
      }),
    ];
  });
}
