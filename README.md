# Flashcards coréen

Application web pour réviser le vocabulaire des cours de coréen : import des notes
Google Docs, page d'accueil listant les cours par date, flashcards avec mode
apprentissage et prononciation audio, et la liste brute des mots sous les cartes.

- **Stack** : Next.js 16 (App Router) + shadcn/ui (Base UI) + Tailwind v4
- **Stockage** : un fichier JSON par cours, dans un volume Docker — pas de base de
  données à administrer, et les notes restent lisibles/éditables à la main
- **Déploiement** : Docker Compose, prêt pour Coolify

## Démarrage local

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Les cours sont écrits dans `web/data/courses/*.json`. Pour changer d'emplacement :
`DATA_DIR=/chemin/vers/data npm run dev`.

## Déploiement (Coolify sur Hostinger)

1. Pousse ce dépôt sur GitHub/GitLab.
2. Dans Coolify : **New Resource → Docker Compose**, pointe sur le dépôt, chemin du
   compose `docker-compose.yml`.
3. Déploie, puis attache ton domaine au service `web` (port interne `3000`).

Le volume `flashcards-data` est monté sur `/data` : il survit aux redéploiements.
Toutes tes notes y vivent, donc c'est le seul chemin à sauvegarder.

En local, la même commande :

```bash
docker compose up -d --build       # http://localhost:3000
PORT=8080 docker compose up -d     # ou sur un autre port
```

### Sauvegarde / restauration

```bash
# Sauvegarde
docker compose cp web:/data/courses ./backup-courses

# Restauration
docker compose cp ./backup-courses/. web:/data/courses
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
- Chaque carte est marquée **Su** ou **À revoir**. En fin de session, un récapitulatif
  permet de **rejouer uniquement les échecs**.

Ces préférences sont mémorisées dans le navigateur.

Raccourcis clavier : `Espace` retourner · `←` à revoir · `→` su · `S` écouter ·
`Retour arrière` carte précédente.

## Audio coréen

L'app utilise d'abord la synthèse vocale du navigateur (voix `ko-KR`), instantanée
et hors ligne. Beaucoup de configurations Linux et certains navigateurs Android
n'embarquent aucune voix coréenne : dans ce cas, l'app bascule automatiquement sur
la route serveur `/api/tts`, qui relaie l'endpoint public de Google Translate.
Cet endpoint n'est pas documenté par Google — considère-le comme un dépannage, pas
comme une garantie de service.

## Ajouter des mots à la main

Bouton **Ajouter un mot** sous la liste. Le mot est écrit immédiatement dans le
JSON du cours (`/data/courses/<id>.json`), au même format que les mots importés.
« Ajouter et continuer » garde la fenêtre ouverte pour enchaîner.

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

## Structure

```
docker-compose.yml          # service unique + volume de données
scripts/import-notes.mjs    # import d'un fichier depuis la ligne de commande
examples/                   # exemples de notes brutes et de JSON
web/                        # l'application Next.js
  app/                      # pages et routes API
  components/               # UI (shadcn/ui) et composants métier
  lib/store.ts              # lecture/écriture des JSON de cours
  lib/parse-notes.ts        # parseur des notes en texte brut
  lib/normalize.ts          # tolérance sur les noms de champs à l'import
  hooks/use-korean-speech.ts
```
