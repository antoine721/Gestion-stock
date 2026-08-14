# Combien acheter ?

Calculateur d'achats pour un evenement : chaque co-organisateur declare les invites qu'il amene et
ce qu'ils boivent, l'app additionne, sort la liste de courses, le budget, et dit si la prevision
tient debout.

## Comment ca marche

```
Profils x effectifs  →  Verres  →  Recettes  →  Ingredients (ml)  →  Bouteilles + €
```

Le principe central : **cote demande on ne raisonne jamais en bouteilles, uniquement en
millilitres d'ingredients**. La conversion en bouteilles n'arrive qu'a la toute fin, une seule fois,
sur le total agrege de tous les participants. C'est ce qui fait que le prosecco du spritz et celui
servi en coupe ne sont achetes qu'une fois, et que les diluants n'ont jamais le mauvais ratio.

On ne compte pas des bouteilles, on compte **des gens**. Un *profil* decrit une personne type de
la bande — « le buveur de biere », « la team spritz » — et ce qu'elle boit **par jour**. Chaque
co-organisateur declare ensuite combien de personnes de chaque profil il amene. Le nombre d'invites
et la part de buveurs en decoulent : plus rien a saisir a la main.

Les profils sont communs a l'evenement, signes par leur createur : celui que tu ecris, les autres
peuvent l'utiliser pour leurs propres invites, le dupliquer ou l'ajuster.

## Structure

| Dossier | Role |
| --- | --- |
| `src/app/domain/` | Modeles, catalogue et moteur de calcul. Fonctions pures, sans Angular, testees. |
| `src/app/state/` | Signals, client HTTP, session. |
| `src/app/components/` | Composants d'interface. |
| `src/app/pages/` | Accueil (creer / rejoindre) et planificateur. |
| `api/` | Fonctions serverless Vercel + schema SQL. |

Le catalogue (`src/app/domain/catalogue.ts`) est statique : produits, prix indicatifs et recettes.
Les prix et contenances sont modifiables dans l'app, produit par produit — ce sont des valeurs de
depart, pas une verite.

## Developpement

```bash
npm install
npm start          # front seul, sans API
npm test           # 58 tests
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

**https://combien-acheter.vercel.app**

Le projet est deja deploye et la base Neon (`combien-acheter`) est initialisee. Pour redeployer
apres une modification :

```bash
npm run deploy
```

## Acces

**Un seul mot de passe pour toute l'app**, defini par la variable d'environnement `MOT_DE_PASSE`
(fichier `.env` en local, variables Vercel en ligne). Pas de comptes, pas de sessions serveur : le
mot de passe voyage dans un en-tete a chaque appel.

A la connexion tu donnes ton prenom et ce mot de passe. Tu arrives sur la liste des evenements :
tu en ouvres un, ou tu en crees un. En ouvrant un evenement tu es automatiquement declare comme
co-organisateur — reprendre le meme prenom depuis un autre appareil reprend ta ligne.

Pour changer le mot de passe :

```bash
vercel env rm MOT_DE_PASSE production
printf 'ton-mot-de-passe' | vercel env add MOT_DE_PASSE production
npm run deploy
```

Tout le monde peut tout modifier : c'est fait pour des gens qui organisent ensemble, pas pour se
proteger les uns des autres. Chaque participant a sa propre ligne en base, donc sauvegarder ta
saisie n'ecrase jamais celle des autres. Les reglages communs (duree, profils, prix, materiel) sont
en dernier-ecrit-gagne.

## Identite visuelle

« La fiche de bar » : le document de derriere le comptoir. L'app est une calculatrice, donc les
chiffres portent l'identite — tout ce qui passe par la classe `.num` est en IBM Plex Mono
tabulaire, et les colonnes de la liste de courses s'alignent comme sur une addition. Titres en
Bricolage Grotesque, texte en Instrument Sans, palette ardoise et petrole. Clair et sombre selon
les preferences du systeme.
