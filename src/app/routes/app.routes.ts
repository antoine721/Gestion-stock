import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../state/session';

/** Sans mot de passe saisi, tout ramene a l'ecran de connexion. */
const connecte = () => {
  const session = inject(SessionStore);
  return session.connecte() ? true : inject(Router).parseUrl('/');
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/connexion/connexion').then((m) => m.Connexion),
    title: 'Combien acheter ?',
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
    title: 'Combien acheter ?',
  },
  { path: '**', redirectTo: '' },
];
