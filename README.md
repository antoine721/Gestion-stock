# Vialcrm

Le hub qui organise un festival entre co-organisateurs : profil de l'evenement (lieu, dates,
compte a rebours), base d'invites avec paiements, bar, cuisine, materiel, liste de courses
unifiee, missions au planning, sets DJ et formulaire public d'inscription.

Au coeur, le calculateur d'achats historique (l'app s'appelait « Combien acheter ? ») : chaque
co-organisateur declare les invites qu'il amene et ce qu'ils boivent, l'app additionne, sort la
liste de courses, le budget, et dit si la prevision tient debout.

## Comment ca marche

```
Profils x effectifs  →  Verres  →  Recettes  →  Ingredients (ml)  →  Bouteilles + €
```

Le principe central : **cote demande on ne raisonne jamais en bouteilles, uniquement en
millilitres d'ingredients**. La conversion en bouteilles n'arrive qu'a la toute fin, une seule fois,
sur le total agrege de tous les participants. C'est ce qui fait que le prosecco du spritz et celui
servi en coupe ne sont achetes qu'une fois, et que les diluants n'ont jamais le mauvais ratio.

On ne compte pas des bouteilles, on compte **des gens**. Un _profil_ decrit une personne type de
la bande — « le buveur de biere », « la team spritz » — et ce qu'elle boit **par jour**. Chaque
co-organisateur declare ensuite combien de personnes de chaque profil il amene. Le nombre d'invites
et la part de buveurs en decoulent : plus rien a saisir a la main.

Les profils sont communs a l'evenement, signes par leur createur : celui que tu ecris, les autres
peuvent l'utiliser pour leurs propres invites, le dupliquer ou l'ajuster.

## Structure

| Dossier               | Role                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| `src/app/domain/`     | Modeles, catalogue et moteur de calcul. Fonctions pures, sans Angular, testees. |
| `src/app/state/`      | Signals, client HTTP, session.                                                  |
| `src/app/components/` | Composants d'interface.                                                         |
| `src/app/pages/`      | Accueil (creer / rejoindre) et planificateur.                                   |
| `api/`                | Fonctions serverless Vercel + schema SQL.                                       |

Le catalogue (`src/app/domain/catalogue.ts`) est statique : produits, prix indicatifs et recettes.
Les prix et contenances sont modifiables dans l'app, produit par produit — ce sont des valeurs de
depart, pas une verite.

## Developpement

```bash
npm install
npm start          # front seul, sans API
npm test           # les tests du domaine et du store
npm run build
```

Pour travailler avec l'API en local, il faut la base (voir ci-dessous) puis :

```bash
npm run dev:api    # vercel dev : sert le front ET les fonctions /api
```

## Mise en ligne

Deux authentifications a faire dans ton terminal (elles ouvrent un navigateur, je ne peux pas les
faire a ta place) :

```bash
vercel login
neonctl auth
```

Ensuite, tout s'enchaine :

```bash
# 1. Creer la base
neonctl projects create --name combien-acheter
neonctl connection-string --project-id <id-affiche-ci-dessus>

# 2. Coller la chaine dans .env (modele dans .env.example), puis creer les tables
npm run db:init

# 3. Lier le projet a Vercel et lui donner la meme chaine
vercel link
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development

# 4. Deployer
npm run deploy
```

## En ligne

| Ce qui tourne ou       | Adresse                                       | Branche   |
| ---------------------- | --------------------------------------------- | --------- |
| Production             | **https://lavialatte.com** (`www` y redirige) | `main`    |
| Preprod                | **https://preprod.lavialatte.com**            | `preprod` |
| L'URL Vercel d'origine | https://vialcrm.vercel.app                    | `main`    |

Le projet est deja deploye et la base Neon (`combien-acheter`) est initialisee. Pour redeployer
apres une modification :

```bash
npm run deploy
```

## Acces

**La partie admin s'ouvre avec un compte Google.** Sur l'ecran de connexion : « Continuer avec
Google ». Si l'adresse figure dans `ADMINS_GOOGLE`, le serveur pose un cookie de session signe
(valable un mois) et tu arrives sur la liste des evenements. Ton prenom vient du compte Google —
c'est lui qui signe les invites que tu amenes, donc le meme compte d'un appareil a l'autre reprend
ta ligne.

Il n'y a toujours ni table utilisateurs ni permissions : la liste des gens autorises tient dans une
variable d'environnement, et une fois entre, tout le monde peut tout modifier. Le formulaire public
des invites (`/f/:code`) ne passe par rien de tout ca : il reste ouvert.

`MOT_DE_PASSE` survit en repli — un lien discret sous le bouton Google — pour depanner quand la
configuration Google casse et pour appeler l'API depuis un terminal. Laisse la variable vide et le
repli se ferme.

### Mettre en place la connexion Google

1. Console Google Cloud → **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Web application**. L'ecran de consentement est « External » : en mode _Testing_ chaque compte
   doit figurer dans _Test users_, en _In production_ n'importe quel compte Google passe l'ecran
   Google et c'est `ADMINS_GOOGLE` qui filtre derriere.
2. **Authorized redirect URIs** : une ligne par domaine servi, Google exige l'URL au caractere pres.

   ```
   https://lavialatte.com/api/auth/callback
   https://preprod.lavialatte.com/api/auth/callback
   http://localhost:3000/api/auth/callback
   ```

3. Poser les variables, en local dans `.env` et en ligne dans Vercel :

   ```bash
   printf '%s' '<client-id>'      | vercel env add GOOGLE_CLIENT_ID production
   printf '%s' '<client-secret>'  | vercel env add GOOGLE_CLIENT_SECRET production
   printf '%s' "$(openssl rand -base64 32)" | vercel env add SESSION_SECRET production
   printf '%s' 'antoine@exemple.com,marie@exemple.com' | vercel env add ADMINS_GOOGLE production
   npm run deploy
   ```

   `ADMINS_GOOGLE` accepte aussi un domaine entier : `@lavialatte.com`.

4. Ajouter ou retirer quelqu'un plus tard, c'est cette seule variable :

   ```bash
   vercel env rm ADMINS_GOOGLE production
   printf '%s' 'antoine@exemple.com,zoe@exemple.com' | vercel env add ADMINS_GOOGLE production
   npm run deploy
   ```

   Le retrait prend effet immediatement, meme sur un cookie encore valide : la liste est relue a
   chaque appel.

## Le circuit

```
branche de travail  ──livrer:preprod──>  preprod  ──livrer:prod──>  main
                                            │                        │
                                 preprod.lavialatte.com        lavialatte.com
```

Deux commandes, et rien d'autre a retenir :

```bash
npm run livrer:preprod   # ta branche de travail part sur la preprod
npm run livrer:prod      # la preprod, si elle te plait, part en production
```

Chacune lance d'abord `npm test`, `npm run build`, le typage des fonctions `api/` et
`npm run format:check` : ce qui monte en ligne a ete verifie. Un echec arrete tout avant le merge.
`SANS_TESTS=1 npm run livrer:prod` saute les verifications — a ne sortir que pour eteindre un
incendie.

Le push est ce qui deploie : `main` va en production, `preprod` va sur la preprod, Vercel s'occupe
du reste. `npm run deploy` (la CLI Vercel) ne sert plus qu'en cas de panne de l'integration Git.

En parallele, `.github/workflows/verification.yml` rejoue les memes verifications sur GitHub a
chaque push et sur chaque PR vers `preprod` ou `main` : le second filet, celui qui ne depend pas de
ta machine.

Une seule chose a regler cote GitHub (Settings → Branches → Add branch ruleset, pour `main` et
`preprod`) : _Block force pushes_.

## Preprod

Une preprod tourne sur **un sous-domaine du domaine de prod** (`preprod.lavialatte.com`), pas sur un
second nom de domaine : un sous-domaine se cree en une ligne de DNS, ne se paie pas, ne se renouvelle
pas, et n'a rien a voir avec des serveurs de noms enfants — ceux-la ne servent qu'a heberger soi-meme
un DNS faisant autorite, ce qu'on ne fait pas ici.

Le montage, une fois pour toutes :

1. **Une branche `preprod`** dans ce depot. C'est elle qu'on deploie ; `main` reste la production.
2. **Vercel → Settings → Domains** : ajouter `preprod.lavialatte.com` au projet et l'assigner a la
   branche `preprod` (« Git Branch »). Vercel affiche l'enregistrement DNS a creer chez le
   registrar : un `CNAME preprod → cname.vercel-dns.com`, et rien d'autre.
3. **Une base a part** : une branche Neon `preprod` (`neonctl branches create --name preprod`) dont
   la chaine de connexion va dans `DATABASE_URL` scope _Preview_. Sans ca, la preprod ecrit dans les
   vraies donnees du festival.
4. **Les memes variables Google, scope _Preview_**, avec deux differences : `SESSION_SECRET` doit
   etre une autre valeur, et `URL_PUBLIQUE=https://preprod.lavialatte.com` doit etre pose — sinon les
   deploiements de preview, dont l'URL est aleatoire, ne pourront jamais correspondre a une URI de
   redirection enregistree chez Google.

```bash
git push -u origin preprod    # chaque push sur cette branche redeploie la preprod
```

## Identite visuelle

« La fiche de bar » : le document de derriere le comptoir. L'app est une calculatrice, donc les
chiffres portent l'identite — tout ce qui passe par la classe `.num` est en IBM Plex Mono
tabulaire, et les colonnes de la liste de courses s'alignent comme sur une addition. Titres en
Bricolage Grotesque, texte en Instrument Sans, palette ardoise et petrole. Clair et sombre selon
les preferences du systeme.
