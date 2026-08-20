# CLAUDE.md

Contexte pour toute session Claude Code sur ce depot, y compris les sessions cloud
qui demarrent sans aucun historique ni configuration locale.

## Le projet

Vialcrm (anciennement « Combien acheter ? ») — le hub d'organisation d'un festival :
profil de l'evenement, invites, paiements, bar, cuisine, materiel, courses, missions,
DJ et formulaire public. Au coeur, le calculateur d'achats : chaque co-organisateur
declare les invites qu'il amene et ce qu'ils boivent ; l'app additionne, sort la liste
de courses et le budget, et dit si la prevision tient debout.

Regle metier centrale : **cote demande on ne raisonne jamais en bouteilles, uniquement
en millilitres d'ingredients**. La conversion en bouteilles arrive a la toute fin, une
seule fois, sur le total agrege de tous les participants. Toute modification du moteur
de calcul doit preserver cet invariant. Voir README.md pour le modele complet.

## Stack

|           |                                                                |
| --------- | -------------------------------------------------------------- |
| Framework | Angular 22 — standalone, signals, control flow `@if` / `@for`  |
| Langage   | TypeScript ~6.0                                                |
| Runtime   | Node.js 22                                                     |
| Paquets   | npm 10.9.8 (champ `packageManager`) — jamais yarn, jamais pnpm |
| Tests     | Vitest 4 via le builder `@angular/build:unit-test`, jsdom      |
| Formatage | Prettier 3. **Il n'y a pas d'ESLint sur ce depot**             |
| Backend   | Fonctions serverless Vercel dans `api/`, base Postgres Neon    |

## Commandes

```bash
npm ci                 # install (respecte package-lock.json)
npm start              # dev front seul, sans API — http://localhost:4200
npm test               # 68 tests, ~5 s, aucune dependance reseau ni base
npm run build          # build production (budgets : 1 MB initial, 8 kB par style)
npm run format:check   # le « lint » de ce depot : verifie le formatage Prettier
npm run format         # corrige le formatage
```

Commandes qui exigent des services externes ou une authentification interactive.
**Ne les lance jamais de ta propre initiative, et jamais en session cloud :**

```bash
npm run dev:api    # vercel dev — exige une auth Vercel par navigateur
npm run db:init    # applique api/schema.sql — exige un vrai DATABASE_URL Neon
npm run deploy     # deploie en production
```

## Regle de travail

**Apres chaque changement, lance `npm test`.** Un changement n'est pas termine tant que
les tests ne passent pas.

Avant de rendre la main ou d'ouvrir une PR, lance les trois, dans cet ordre :

```bash
npm test && npm run build && npm run format:check
```

`npm run build` n'est pas redondant avec `npm test` : il fait la verification de types
complete sur les fichiers que les specs ne couvrent pas. Si `format:check` echoue,
lance `npm run format` puis recommence. Ne signale jamais un travail comme termine
avec un build casse — dis explicitement ce qui echoue.

## Structure

| Chemin                | Role                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/app/domain/`     | Modeles, catalogue, moteur de calcul, validation. **Fonctions pures, zero import Angular.** C'est la que vivent les tests. |
| `src/app/state/`      | `planner-store.ts` (signals), `api.ts` (client HTTP), `session.ts`                                                         |
| `src/app/components/` | Composants d'interface, un dossier par composant (`.ts` + `.html` + `.css`)                                                |
| `src/app/pages/`      | `connexion`, `evenements`, `planner`                                                                                       |
| `src/app/routes/`     | `app.routes.ts`                                                                                                            |
| `api/`                | Fonctions serverless Vercel + `schema.sql`. Tourne sur Node, pas dans le navigateur                                        |
| `api/auth/`           | Connexion Google de la partie admin (`_auth.ts` : cookie signe, liste blanche). Le formulaire public n'y passe pas         |
| `scripts/`            | Utilitaires Node (init de la base, setup de session)                                                                       |
| `public/`             | Assets statiques copies tels quels                                                                                         |

## Conventions

- **Tout est en francais, sans accents dans le code** : identifiants, noms de fichiers,
  commentaires. `chargerEvenement`, `nouveauCode`, `evenements`, `personnes-types.ts`.
  Les accents ne vivent que dans les templates et les chaines affichees a l'ecran.
  Suis cette regle meme si elle surprend, la coherence prime.
- **Composants** : standalone, `changeDetection: ChangeDetectionStrategy.OnPush`,
  `templateUrl` + `styleUrl` (jamais de template ni de styles inline), dependances
  injectees par `inject()`. Les membres exposes au template sont `protected readonly`.
- **Etat derive** : `computed()`. Pas de `ngOnInit` pour calculer ce qu'un `computed` fait.
- **Templates** : control flow `@if` / `@for`, jamais `*ngIf` / `*ngFor`.
- **Le domaine reste pur** : `src/app/domain/` n'importe ni `@angular/*` ni le store.
  C'est ce qui rend le calcul testable — ne le casse pas pour gagner une ligne.
- **Commentaires** : ils expliquent le _pourquoi_ metier, pas le _quoi_. Lis le ton de
  `api/_db.ts` et `src/app/components/extras/extras.ts` et ecris pareil.
- **Formatage** : Prettier, 100 colonnes, guillemets simples, indentation 2 espaces.
  Ne reformate pas des fichiers que tu n'as pas modifies par ailleurs.
- **Types** : l'`any` implicite est une erreur de compilation. Type les callbacks.

## Ce qu'il ne faut PAS toucher

- `package-lock.json` — jamais a la main ; il change via `npm install <paquet>`.
- `.env` et `.env.local` — non versionnes, ils contiennent de vrais secrets.
  `.env.local` est genere par la CLI Vercel. Ne les cree pas, ne les lis pas,
  ne les commite pas. Le seul fichier d'environnement versionne est `.env.example`,
  qui ne contient aucune valeur.
- `dist/`, `.angular/`, `.vercel/`, `node_modules/` — generes.
- `api/schema.sql` — le schema est deja applique sur la base de production. Le modifier
  implique une migration : demande avant, ne le fais pas en autonomie.
- La base et le deploiement : ne lance jamais `npm run db:init`, `npm run deploy`,
  ni aucune commande `vercel`.
- `src/app/domain/catalogue.ts` — les prix, contenances et recettes sont des valeurs
  choisies a la main. Ne les « corrige » pas sans qu'on te le demande.

## Variables d'environnement

Toutes documentees dans `.env.example`. Aucune n'est necessaire pour `npm test`,
`npm run build` ou `npm start` : elles ne servent qu'aux fonctions `api/`.
L'admin se franchit avec un compte Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`SESSION_SECRET`, `ADMINS_GOOGLE`) ; `MOT_DE_PASSE` n'est plus qu'un repli.
Si une commande reclame `DATABASE_URL`, c'est que tu lances quelque chose que tu
ne devrais pas lancer — arrete-toi et signale-le.

## Git

- Branche par defaut : `main`. Travaille sur une branche dediee, pas sur `main`.
- Ne commite jamais `.env`, `.env.local`, ni aucune valeur secrete.
- Pas de `git push --force` sur `main`.
