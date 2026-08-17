import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlannerStore } from '../../state/planner-store';
import { dateDuJour, joursAvant } from '../../domain/evenement';
import { nomDeRef, planningDuJour } from '../../domain/programme';
import { fmtEntier, fmtEuro } from '../../domain/format';

/** Une etape du parcours invites, avec sa geometrie de ruban. */
interface SegmentParcours {
  nom: string;
  valeur: number;
  couleur: string;
  /** L'aire remplie du segment, ancree sur la ligne de base. */
  aire: string;
  /** La crete du segment, tracee en plein par-dessus l'aire. */
  crete: string;
}

const COULEURS_PARCOURS = [
  'var(--teinte-orange)',
  'var(--teinte-violet)',
  'var(--teinte-bleu)',
  'var(--teinte-vert)',
];

/**
 * L'accueil-dashboard : la ligne de KPIs, le parcours des invites en ruban,
 * la sante de la preparation, le budget par poste et le planning du jour.
 * C'est la page qu'on ouvre pour repondre a « on en est ou ? » d'un coup
 * d'oeil, avant de plonger dans un espace.
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

  protected readonly jour = signal(1);

  protected readonly entete = computed(() => {
    const infos = this.store.infos();
    const avant = joursAvant(infos.debut, new Date());
    const format = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
    const date = (iso: string) => (iso ? format.format(new Date(`${iso}T00:00:00`)) : '');
    const debut = date(infos.debut);
    const fin = date(infos.fin);
    return {
      dates: debut && fin && fin !== debut ? `${debut} – ${fin}` : debut,
      lieu: infos.lieu,
      jChip: avant === null ? '' : avant > 0 ? `J-${avant}` : avant === 0 ? "Aujourd'hui" : '',
    };
  });

  protected readonly missions = computed(() => {
    const resume = this.store.resumeProgramme();
    return {
      total: resume.creneaux,
      pourvues: resume.creneaux - resume.sansAssigne,
      vacantes: resume.sansAssigne,
    };
  });

  /** Fiches -> profil -> tarif -> payes : ou en est la base d'invites. */
  protected readonly parcours = computed<SegmentParcours[]>(() => {
    const invites = this.store.invitesNommes();
    const valeurs = [
      invites.length,
      invites.filter((x) => x.personneTypeId !== '').length,
      invites.filter((x) => x.categoriePaiementId !== '').length,
      invites.filter((x) => x.paye).length,
    ];
    const noms = ['Fiches creees', 'Profil attribue', 'Tarif attribue', 'Payes'];
    const max = Math.max(1, valeurs[0]);
    const hauteur = (v: number) => Math.max(14, (v / max) * 128);
    const largeur = 200;

    return valeurs.map((valeur, i) => {
      const x0 = i * largeur + (i > 0 ? 2 : 0);
      const x1 = (i + 1) * largeur - (i < valeurs.length - 1 ? 2 : 0);
      const yGauche = 145 - hauteur(valeurs[i === 0 ? 0 : i - 1]);
      const yDroite = 145 - hauteur(valeur);
      const c1 = x0 + (x1 - x0) * 0.4;
      const c2 = x1 - (x1 - x0) * 0.4;
      const crete = `M ${x0} ${yGauche} C ${c1} ${yGauche}, ${c2} ${yDroite}, ${x1} ${yDroite}`;
      return {
        nom: noms[i],
        valeur,
        couleur: COULEURS_PARCOURS[i],
        aire: `M ${x0} 145 L ${x0} ${yGauche} C ${c1} ${yGauche}, ${c2} ${yDroite}, ${x1} ${yDroite} L ${x1} 145 Z`,
        crete,
      };
    });
  });

  /** Le conseil sous le ruban : la marche qui bloque le plus. */
  protected readonly conseil = computed(() => {
    const encaissements = this.store.encaissements();
    if (encaissements.enAttente > 0) {
      return {
        titre: 'Le paiement est le maillon faible',
        texte: `${fmtEuro(encaissements.reste)} restent a encaisser aupres de ${fmtEntier(encaissements.enAttente)} personne(s). Un rappel du tarif dans le groupe suffit souvent.`,
      };
    }
    const sansProfil = this.store.invitesNommes().filter((x) => !x.personneTypeId).length;
    if (sansProfil > 0) {
      return {
        titre: 'Des fiches sans profil de consommation',
        texte: `${fmtEntier(sansProfil)} invite(s) ne comptent pas encore au bar : attribue-leur un profil pour fiabiliser les courses.`,
      };
    }
    return undefined;
  });

  /** Un score global de preparation : la moyenne des fronts ouverts. */
  protected readonly sante = computed(() => {
    const ratios: number[] = [];
    const invites = this.store.invitesNommes();
    if (invites.length > 0) {
      ratios.push(invites.filter((x) => x.personneTypeId !== '').length / invites.length);
    }
    const encaissements = this.store.encaissements();
    if (encaissements.attendu > 0) {
      ratios.push(Math.min(1, encaissements.encaisse / encaissements.attendu));
    }
    const missions = this.missions();
    if (missions.total > 0) ratios.push(missions.pourvues / missions.total);
    const nourriture = this.store.budgetNourriture();
    const cases = nourriture.repasPrevus + nourriture.repasManquants;
    if (cases > 0) ratios.push(nourriture.repasPrevus / cases);
    const courses = this.store.resumeCourses();
    if (courses.lignes > 0) ratios.push(courses.cochees / courses.lignes);

    const score =
      ratios.length > 0
        ? Math.round((ratios.reduce((somme, x) => somme + x, 0) / ratios.length) * 100)
        : 100;
    const etat = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'ko';
    const libelle = score >= 80 ? 'Tout roule' : score >= 50 ? 'Attention' : 'Alerte';
    // Arc de jauge : rayon 35 -> circonference ~220.
    return { score, etat, libelle, arc: `${(score / 100) * 220} 220` };
  });

  /** Les fronts encore ouverts, en puces cliquables. */
  protected readonly fronts = computed(() => {
    const liste: { texte: string; espace: 'utilisateurs' | 'programme' | 'nourriture' | 'dj' }[] =
      [];
    const encaissements = this.store.encaissements();
    if (encaissements.enAttente > 0) {
      liste.push({
        texte: `${fmtEntier(encaissements.enAttente)} paiement(s) en attente`,
        espace: 'utilisateurs',
      });
    }
    const missions = this.missions();
    if (missions.vacantes > 0) {
      liste.push({
        texte: `${fmtEntier(missions.vacantes)} mission(s) a pourvoir`,
        espace: 'programme',
      });
    }
    const nourriture = this.store.budgetNourriture();
    if (nourriture.repasManquants > 0) {
      liste.push({
        texte: `${fmtEntier(nourriture.repasManquants)} repas a decider`,
        espace: 'nourriture',
      });
    }
    const dj = this.store.resumeDj();
    if (dj.demandes > 0) {
      liste.push({ texte: `${fmtEntier(dj.demandes)} set(s) DJ a valider`, espace: 'dj' });
    }
    return liste.slice(0, 4);
  });

  protected readonly postes = computed(() => {
    const couleurs: Record<string, string> = {
      alcool: 'var(--donnee-alcool)',
      nourriture: 'var(--donnee-nourriture)',
      materiel: 'var(--donnee-materiel)',
    };
    return this.store
      .budgetGlobal()
      .postes.filter((x) => x.montant > 0)
      .map((x) => ({ ...x, couleur: couleurs[x.id] ?? 'var(--teinte-ardoise)' }));
  });

  protected readonly jours = computed(() =>
    Array.from({ length: Math.max(1, this.store.partage().jours) }, (_, i) => i + 1),
  );

  protected readonly journee = computed(() => {
    const jour = this.jour();
    const date = dateDuJour(this.store.infos().debut, jour);
    const format = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return {
      titre: date ? format.format(date) : `Jour ${jour}`,
      creneaux: planningDuJour(this.store.programme(), jour).map((x) => ({
        ...x,
        equipe: x.assignes
          .map((ref) => nomDeRef(ref, this.store.participants(), this.store.invitesNommes()))
          .filter((nom) => nom.length > 0)
          .join(', '),
      })),
    };
  });
}
