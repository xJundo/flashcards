# Flashcards coréen

Application web pour réviser le vocabulaire des cours de coréen : import des notes
Google Docs, page d'accueil listant les cours par date, flashcards avec mode
apprentissage et prononciation audio, et la liste brute des mots sous les cartes.

- **Stack** : Next.js 16 (App Router) + shadcn/ui (Base UI) + Tailwind v4
- **Base de données** : PostgreSQL, accédée via Drizzle
- **Comptes** : better-auth (email + mot de passe), inscription ouverte à tous
- **Déploiement** : Docker Compose, prêt pour Coolify

## Comptes et droits

- **Lecture publique** : n'importe qui, même sans compte, consulte les cours et
  révise. Rien n'est enregistré tant qu'on n'est pas connecté.
- **Publier** demande un compte. Chaque cours affiche le **pseudo** de son auteur ;
  l'email ne sert qu'à se connecter et n'est jamais montré.
- **Modifier** un cours est réservé à son auteur et aux comptes qu'il a cochés dans
  **Partager** (par pseudo, ou en tapant l'email d'un compte existant).
- **La progression est privée** : mots à revoir et historique des séries sont
  rattachés au compte, invisibles aux autres, et te suivent d'un appareil à l'autre.

## Démarrage local

```bash
cd web
npm install
cp .env.example .env.local     # puis renseigne les valeurs
npm run dev                    # http://localhost:3000
```

Il faut un PostgreSQL joignable. Le plus simple :

```bash
docker run -d --name flashcards-db -p 5433:5432 \
  -e POSTGRES_USER=flashcards -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=flashcards \
  postgres:18-alpine
```

Les migrations s'appliquent toutes seules au démarrage de l'app (`instrumentation.ts`).
Pour les jouer à la main : `npx drizzle-kit migrate`. Après un changement de schéma
dans `web/lib/db/schema.ts` : `npx drizzle-kit generate --name ma_migration`.

### Variables d'environnement

| Variable             | Rôle                                                      |
| -------------------- | --------------------------------------------------------- |
| `DATABASE_URL`       | Connexion PostgreSQL                                       |
| `BETTER_AUTH_SECRET` | Signe les cookies de session — la changer déconnecte tout le monde |
| `BETTER_AUTH_URL`    | URL publique de l'app (cookies, redirections)             |

En prod, `docker-compose.yml` attend en plus `POSTGRES_PASSWORD` (et accepte
`POSTGRES_USER` / `POSTGRES_DB` / `PORT`).

## Déploiement (Coolify sur Hostinger)

1. Pousse ce dépôt sur GitHub/GitLab.
2. Dans Coolify : **New Resource → Docker Compose**, pointe sur le dépôt, chemin du
   compose `docker-compose.yml`.
3. Renseigne les variables d'environnement : `POSTGRES_PASSWORD`,
   `BETTER_AUTH_SECRET` (au moins 32 caractères aléatoires — `openssl rand -base64 32`)
   et `BETTER_AUTH_URL` avec ton domaine en `https://`.
4. Déploie, puis attache ton domaine au service `web` (port interne `3000`).

Le volume `flashcards-db` porte toute la base — cours, comptes et progression. C'est
le seul chemin à sauvegarder, et il survit aux redéploiements. Attention : supprimer
puis recréer la ressource dans Coolify repart sur un volume vide.

En local, la même commande :

```bash
docker compose up -d --build       # http://localhost:3000
PORT=8080 docker compose up -d     # ou sur un autre port
```

### Sauvegarde / restauration

```bash
# Sauvegarde
docker compose exec -T db pg_dump -U flashcards flashcards > backup.sql

# Restauration
docker compose exec -T db psql -U flashcards -d flashcards < backup.sql
```

## Importer les notes Google Docs

Trois chemins, tous équivalents — ils passent par le même parseur.

### 1. Depuis l'interface (le plus simple)

Bouton **Importer** sur la page d'accueil. Deux onglets :

- **Texte brut** : colle directement ce que tu as copié depuis Google Docs.
- **JSON** : colle un JSON structuré (voir le format plus bas).

Un aperçu s'affiche en direct avec le nombre de mots détectés et les lignes non
reconnues, avant de valider.

### 2. Depuis la ligne de commande

```bash
# L'app doit tourner (local ou en prod)
node scripts/import-notes.mjs examples/notes-brutes.txt
node scripts/import-notes.mjs examples/cours.json --url https://coreen.mondomaine.fr

# Voir le JSON produit sans rien créer
node scripts/import-notes.mjs mes-notes.txt --dry-run
node scripts/import-notes.mjs mes-notes.txt -o cours.json

# Forcer le titre / la date
node scripts/import-notes.mjs mes-notes.txt --title "Leçon 3" --date 2026-03-04
```

L'URL par défaut est `http://localhost:3000`, surchargeable via `--url` ou la
variable d'environnement `FLASHCARDS_URL`.

Créer un cours demandant un compte, le script a besoin d'une session : copie le
cookie d'un navigateur connecté (devtools → Application → Cookies) dans
`FLASHCARDS_COOKIE`.

```bash
FLASHCARDS_COOKIE='better-auth.session_token=…' node scripts/import-notes.mjs notes.txt
```

### 3. En passant par ChatGPT

Si tes notes sont trop irrégulières pour le parseur, colle-les dans ChatGPT avec :

> Transforme ces notes de cours de coréen en JSON. Réponds **uniquement** avec le
> JSON, sans texte autour, au format :
> `{ "title": "...", "date": "AAAA-MM-JJ", "words": [{ "mot": "...", "prononciation": "...", "traduction": "...", "note_additionnelle": "..." }] }`
> Le champ `prononciation` est la romanisation du mot coréen.
> `note_additionnelle` est facultatif : ne le mets que s'il y a quelque chose à
> préciser (deux mots qui se prononcent pareil, une règle particulière). Garde
> l'ordre des mots de la note. Si une date apparaît dans les notes, utilise-la.

Puis colle le résultat dans l'onglet **JSON** de l'import.

### Formats acceptés

**Texte brut** — un mot par ligne, séparateurs `-`, `|`, `:`, `/`, `→` ou tabulation :

```
04/03/2026 — Leçon 3 : la famille

가족 - gajok - la famille
아버지 | abeoji | le père
어머니 (eomeoni) : la mère
동생	dongsaeng	le cadet
```

La première ligne est reconnue comme date + titre si elle en contient. Les puces
(`-`, `•`, `1.`) sont ignorées. Une ligne à deux colonnes est acceptée : la
romanisation est devinée quand elle en a la forme, sinon c'est une traduction.

**JSON** — un cours, ou un tableau de cours, ou un simple tableau de mots :

```json
{
  "title": "Leçon 1 : les salutations",
  "date": "2026-02-11",
  "words": [
    { "mot": "안녕하세요", "prononciation": "annyeonghaseyo", "traduction": "bonjour" },
    {
      "mot": "말",
      "prononciation": "mal",
      "traduction": "cheval",
      "note_additionnelle": "말 (mal) veut aussi dire « parole » — voyelle brève ici"
    }
  ]
}
```

Les noms de champs sont tolérants — la casse, les accents et les séparateurs
sont ignorés (`note_additionnelle`, `Note additionnelle` et `note-additionnelle`
sont la même colonne) : `mot`/`korean`/`word`/`hangul`,
`prononciation`/`romanization`/`romaja`, `traduction`/`translation`/`meaning`,
plus une note facultative (`note`/`note_additionnelle`/`remarque`/`exemple`/
`explication`/`règle`/`astuce`), affichée sous le mot sur la carte. Si un mot
porte plusieurs de ces champs à la fois, ils sont conservés et joints par
un `·`. Des exemples complets sont dans [`examples/`](./examples).

## Utiliser les flashcards

Sur la page d'un cours, deux sections :

1. **Flashcards** — la session de révision.
2. **Tous les mots du cours** — la liste brute, dans l'ordre de la note, avec
   recherche, écoute, édition, suppression et ajout de mots.

Options de la session :

- **Coréen / Français / Aléatoire / Écoute** : quelle face est affichée en premier.
  « Aléatoire » tire le sens carte par carte. « Écoute » n'affiche pas le mot :
  la carte joue la prononciation, à toi de l'écrire avant de retourner. Le
  bouton **Prononciation** décide si la romanisation s'affiche en indice — coupe-le
  pour une écoute pure.
- **Mélanger / Ordre du cours** : ordre de passage des cartes.
- **Audio auto** : joue la prononciation dès que la face coréenne apparaît.
- Chaque carte est marquée **Acquis** ou **À revoir**. En fin de série, un récapitulatif
  permet de **rejouer uniquement les échecs**.

Ces préférences sont mémorisées dans le navigateur.

Raccourcis clavier : `Espace` retourner · `←` à revoir · `→` acquis · `S` écouter ·
`Retour arrière` carte précédente.

### Suivi : à revoir et historique des séries

La colonne de droite garde la trace du travail, série après série :

- **À revoir** — tout mot raté en fin de série y atterrit automatiquement et y
  reste jusqu'à ce que tu le repasses en acquis. Le bouton **Travailler ces N
  mots** lance une série avec eux seuls ; l'icône ✓ retire un mot à la main, et
  le haut-parleur le fait écouter.
- **Séries** — le score de chaque série terminée (barre de réussite, `réussis /
  total`, date), les plus récentes en haut.

Ce suivi est rattaché à ton compte, en base : il te suit d'un appareil à l'autre et
reste invisible aux autres. Sans compte, la révision fonctionne mais rien n'est
enregistré.

## Audio coréen

L'app utilise d'abord la synthèse vocale du navigateur (voix `ko-KR`), instantanée
et hors ligne. Beaucoup de configurations Linux et certains navigateurs Android
n'embarquent aucune voix coréenne : dans ce cas, l'app bascule automatiquement sur
la route serveur `/api/tts`, qui relaie l'endpoint public de Google Translate.
Cet endpoint n'est pas documenté par Google — considère-le comme un dépannage, pas
comme une garantie de service.

## Ajouter des mots à la main

Bouton **Ajouter un mot** sous la liste — visible seulement si tu as l'accès en
écriture. Le mot est enregistré immédiatement en base, au même format que les mots
importés. « Ajouter et continuer » garde la fenêtre ouverte pour enchaîner.

Le bouton **Exporter** récupère le JSON complet d'un cours, prêt à être réimporté
ailleurs ou versionné.

## API

| Méthode  | Route                                | Rôle                                     |
| -------- | ------------------------------------ | ---------------------------------------- |
| `GET`    | `/api/courses`                       | Liste des cours                          |
| `POST`   | `/api/courses`                       | Créer / importer (`json`, `text`, ou ni l'un ni l'autre pour un cours vide) |
| `GET`    | `/api/courses/:id`                   | Un cours avec ses mots                   |
| `PATCH`  | `/api/courses/:id`                   | Renommer / redater                       |
| `DELETE` | `/api/courses/:id`                   | Supprimer                                |
| `GET`    | `/api/courses/:id/export`            | Télécharger le JSON                      |
| `POST`   | `/api/courses/:id/words`             | Ajouter un mot (ou `{ "words": [...] }`) |
| `PATCH`  | `/api/courses/:id/words/:wordId`     | Modifier un mot                          |
| `DELETE` | `/api/courses/:id/words/:wordId`     | Supprimer un mot                         |
| `POST`   | `/api/parse`                         | Aperçu d'un import, sans écriture        |
| `GET`    | `/api/tts?text=…`                    | Audio coréen (repli serveur)             |
| `GET`    | `/api/courses/:id/editors`           | Qui peut écrire + comptes existants (auteur seul) |
| `POST`   | `/api/courses/:id/editors`           | Retrouver un compte par email (auteur seul) |
| `PUT`    | `/api/courses/:id/editors`           | Remplacer la liste des accès (auteur seul) |
| `GET`    | `/api/courses/:id/progress`          | Ma progression sur ce cours              |
| `POST`   | `/api/courses/:id/progress`          | Enregistrer une série, ou marquer un mot acquis |
| `*`      | `/api/auth/*`                        | Inscription, connexion, session (better-auth) |

Les routes de lecture sont ouvertes ; toute écriture sur un cours exige d'en être
l'auteur ou d'y avoir été invité (`401` sans compte, `403` sans les droits).

## Structure

```
docker-compose.yml          # web + postgres, avec le volume de la base
scripts/import-notes.mjs    # import d'un fichier depuis la ligne de commande
examples/                   # exemples de notes brutes et de JSON
web/                        # l'application Next.js
  app/                      # pages et routes API
  components/               # UI (shadcn/ui) et composants métier
  drizzle/                  # migrations SQL, jouées au démarrage
  instrumentation.ts        # applique les migrations au boot du serveur
  lib/db/schema.ts          # le schéma : comptes, cours, mots, accès, progression
  lib/store.ts              # requêtes des cours + règles de droits
  lib/progress-store.ts     # progression par compte
  lib/auth.ts               # configuration better-auth
  lib/guard.ts              # garde d'écriture partagée par les routes API
  lib/parse-notes.ts        # parseur des notes en texte brut
  lib/normalize.ts          # tolérance sur les noms de champs à l'import
  hooks/use-korean-speech.ts
```
