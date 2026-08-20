import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Connexion } from './connexion';
import { Api } from '../../state/api';
import { SessionStore } from '../../state/session';
import { routes } from '../../routes/app.routes';

class ApiFausse {
  motDePasseVerifie?: string;
  refuse = false;

  async verifier(motDePasse: string) {
    this.motDePasseVerifie = motDePasse;
    if (this.refuse) throw new Error('Mot de passe incorrect');
  }
}

/** Personne n'est connecte cote serveur, sauf mention contraire. */
function serveurSansSession() {
  return async () => new Response('{}', { status: 401 });
}

describe('Connexion', () => {
  let api: ApiFausse;
  const fetchOriginal = globalThis.fetch;

  function preparer(parametres: Record<string, string> = {}) {
    api = new ApiFausse();
    TestBed.configureTestingModule({
      imports: [Connexion],
      providers: [
        provideRouter(routes),
        { provide: Api, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(parametres) } },
        },
      ],
    });
  }

  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = serveurSansSession() as typeof fetch;
    preparer();
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  async function monter() {
    const fixture = TestBed.createComponent(Connexion);
    await fixture.whenStable();
    return { fixture, hote: fixture.nativeElement as HTMLElement };
  }

  it('propose Google, et rien a remplir', async () => {
    const { hote } = await monter();

    expect(hote.querySelector<HTMLAnchorElement>('a.google')?.getAttribute('href')).toBe(
      '/api/auth/google?retour=%2Fevenements',
    );
    expect(hote.querySelectorAll('.champ').length).toBe(0);
  });

  it("renvoie apres Google vers la page qu'on voulait", async () => {
    TestBed.resetTestingModule();
    preparer({ retour: '/e/abcd' });
    const { hote } = await monter();

    expect(hote.querySelector<HTMLAnchorElement>('a.google')?.getAttribute('href')).toBe(
      '/api/auth/google?retour=%2Fe%2Fabcd',
    );
  });

  it('affiche le refus renvoye par le serveur', async () => {
    TestBed.resetTestingModule();
    preparer({ erreur: "zoe@exemple.com n'est pas dans l'equipe d'organisation." });
    const { hote } = await monter();

    expect(hote.querySelector('.erreur')?.textContent).toContain("n'est pas dans l'equipe");
  });

  it('ouvre le repli mot de passe a la demande', async () => {
    const { fixture, hote } = await monter();
    hote.querySelector<HTMLButtonElement>('.secours')?.click();
    fixture.detectChanges();

    const libelles = [...hote.querySelectorAll('.champ > span')].map((x) => x.textContent?.trim());
    expect(libelles).toEqual(['Ton prenom', 'Mot de passe']);
  });

  it('refuse une saisie incomplete sans appeler le serveur', async () => {
    const { fixture, hote } = await monter();
    hote.querySelector<HTMLButtonElement>('.secours')?.click();
    fixture.detectChanges();
    hote.querySelector<HTMLButtonElement>('.valider')?.click();
    await fixture.whenStable();

    expect(hote.querySelector('.erreur')?.textContent).toContain('prenom');
    expect(api.motDePasseVerifie).toBeUndefined();
  });

  it('ouvre la session quand le mot de passe passe', async () => {
    const { fixture } = await monter();
    fixture.componentInstance['prenom'].set('Antoine');
    fixture.componentInstance['motDePasse'].set('secret');
    await fixture.componentInstance['entrer']();

    expect(api.motDePasseVerifie).toBe('secret');
    expect(TestBed.inject(SessionStore).session()).toEqual({
      motDePasse: 'secret',
      prenom: 'Antoine',
    });
  });

  it('laisse la session fermee quand le mot de passe est refuse', async () => {
    api.refuse = true;
    const { fixture, hote } = await monter();
    fixture.componentInstance['prenom'].set('Antoine');
    fixture.componentInstance['motDePasse'].set('faux');
    await fixture.componentInstance['entrer']();
    fixture.detectChanges();

    expect(TestBed.inject(SessionStore).session()).toBeUndefined();
    expect(hote.querySelector('.erreur')?.textContent).toContain('incorrect');
  });
});
