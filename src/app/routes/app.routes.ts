import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { SessionStore } from '../state/session';

/**
 * Sans session, tout ramene a l'ecran de connexion — en gardant la page
 * demandee sous le bras : le lien /e/CODE qu'on t'a partage doit survivre au
 * passage par Google. Le cookie peut d'ailleurs etre valide sans que ce
 * navigateur en sache rien, donc on laisse le store interroger le serveur
 * avant de refuser.
 */
const connecte: CanActivateFn = async (_route, etat) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (await session.restaurer()) return true;

  const cible = router.parseUrl('/');
  cible.queryParams = { retour: etat.url };
  return cible;
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/connexion/connexion').then((m) => m.Connexion),
    title: 'Vialcrm',
  },
  {
    path: 'evenements',
    canActivate: [connecte],
    loadComponent: () => import('../pages/evenements/evenements').then((m) => m.Evenements),
    title: 'Tes evenements',
  },
  {
    path: 'e/:code',
    canActivate: [connecte],
    loadComponent: () => import('../pages/planner/planner').then((m) => m.Planner),
    title: 'Vialcrm',
  },
  {
    // La seule page publique : la fiche que remplissent les invites eux-memes.
    path: 'f/:code',
    loadComponent: () =>
      import('../pages/formulaire-public/formulaire-public').then((m) => m.FormulairePublic),
    title: 'Ta fiche invite',
  },
  { path: '**', redirectTo: '' },
];
