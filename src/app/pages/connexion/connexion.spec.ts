import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

describe('Connexion', () => {
  let api: ApiFausse;

  beforeEach(() => {
    localStorage.clear();
    api = new ApiFausse();
    TestBed.configureTestingModule({
      imports: [Connexion],
      providers: [provideRouter(routes), { provide: Api, useValue: api }],
    });
  });

  async function monter() {
    const fixture = TestBed.createComponent(Connexion);
    await fixture.whenStable();
    return { fixture, hote: fixture.nativeElement as HTMLElement };
  }

  it('demande un prenom et un mot de passe, rien de plus', async () => {
    const { hote } = await monter();
    const libelles = [...hote.querySelectorAll('.champ > span')].map((x) => x.textContent?.trim());

    expect(libelles).toEqual(['Ton prenom', 'Mot de passe']);
  });

  it('refuse une saisie incomplete sans appeler le serveur', async () => {
    const { fixture, hote } = await monter();
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
