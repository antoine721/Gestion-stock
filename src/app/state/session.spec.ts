import { TestBed } from '@angular/core/testing';
import { SessionStore } from './session';

/** Un serveur en carton : on note ce qu'on lui demande, il repond ce qu'on veut. */
function serveur(reponses: (() => Response)[]) {
  const appels: { url: string; methode: string }[] = [];
  const faux = async (url: string, options?: { method?: string }) => {
    appels.push({ url, methode: options?.method ?? 'GET' });
    const suivante = reponses.shift();
    if (!suivante) throw new Error('Appel inattendu');
    return suivante();
  };
  globalThis.fetch = faux as unknown as typeof fetch;
  return appels;
}

const identite = () =>
  new Response(JSON.stringify({ email: 'antoine@exemple.com', prenom: 'Antoine', photo: '' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const refus = () => new Response('{}', { status: 401 });

describe('SessionStore', () => {
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it('reprend aupres du serveur la session posee par Google', async () => {
    const appels = serveur([identite]);
    const store = TestBed.inject(SessionStore);

    expect(store.connecte()).toBe(false);
    expect(await store.restaurer()).toBe(true);
    expect(appels).toEqual([{ url: '/api/auth/moi', methode: 'GET' }]);
    expect(store.session()).toEqual({
      email: 'antoine@exemple.com',
      prenom: 'Antoine',
      photo: '',
    });
  });

  it('ne redemande pas au serveur une session deja connue', async () => {
    const appels = serveur([identite]);
    const store = TestBed.inject(SessionStore);

    await store.restaurer();
    await store.restaurer();

    expect(appels.length).toBe(1);
  });

  it('ne met pas un refus en cache : le cookie peut arriver plus tard', async () => {
    const appels = serveur([refus, identite]);
    const store = TestBed.inject(SessionStore);

    expect(await store.restaurer()).toBe(false);
    expect(await store.restaurer()).toBe(true);
    expect(appels.length).toBe(2);
  });

  it('se deconnecte aussi cote serveur', async () => {
    const appels = serveur([identite, () => new Response('{}', { status: 200 })]);
    const store = TestBed.inject(SessionStore);
    await store.restaurer();

    await store.fermer();

    expect(store.connecte()).toBe(false);
    expect(localStorage.getItem('apero-planner/session')).toBeNull();
    expect(appels[1]).toEqual({ url: '/api/auth/deconnexion', methode: 'POST' });
  });

  it('ignore une session enregistree qui ne prouve rien', () => {
    localStorage.setItem('apero-planner/session', JSON.stringify({ prenom: 'Antoine' }));

    expect(TestBed.inject(SessionStore).session()).toBeUndefined();
  });
});
