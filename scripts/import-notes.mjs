#!/usr/bin/env node
/**
 * Envoie un fichier de notes (texte brut ou JSON) à l'application pour en faire
 * un cours. Le parsing est fait par l'app elle-même (`/api/parse`,
 * `/api/courses`), donc le script et l'interface web se comportent à l'identique.
 *
 * Usage :
 *   node scripts/import-notes.mjs notes.txt
 *   node scripts/import-notes.mjs notes.json --url https://coreen.mondomaine.fr
 *   node scripts/import-notes.mjs notes.txt --title "Leçon 3" --date 2026-03-04
 *   node scripts/import-notes.mjs notes.txt --dry-run -o cours.json
 */

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const USAGE = `Usage: node scripts/import-notes.mjs <fichier> [options]

Options:
  --url <url>       URL de l'app (défaut: $FLASHCARDS_URL ou http://localhost:3000)
  --title <titre>   Force le titre du cours
  --date <date>     Force la date du cours (YYYY-MM-DD)
  --dry-run         N'écrit rien: affiche le JSON qui serait importé
  -o, --out <file>  Écrit le résultat du dry-run dans un fichier
  -h, --help        Affiche cette aide
`

function parseArgs(argv) {
  const options = {
    url: process.env.FLASHCARDS_URL ?? "http://localhost:3000",
    dryRun: false,
  }
  const positional = []

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true
        break
      case "--dry-run":
        options.dryRun = true
        break
      case "--url":
        options.url = argv[++index]
        break
      case "--title":
        options.title = argv[++index]
        break
      case "--date":
        options.date = argv[++index]
        break
      case "-o":
      case "--out":
        options.out = argv[++index]
        options.dryRun = true
        break
      default:
        if (arg.startsWith("-")) throw new Error(`Option inconnue: ${arg}`)
        positional.push(arg)
    }
  }

  return { options, file: positional[0] }
}

async function post(url, body) {
  let response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Creating a lesson needs an account: paste the session cookie from a
        // signed-in browser (devtools → Application → Cookies).
        ...(process.env.FLASHCARDS_COOKIE
          ? { cookie: process.env.FLASHCARDS_COOKIE }
          : {}),
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new Error(
      `Impossible de joindre ${url}. L'application tourne-t-elle ? (${error.message})`
    )
  }
  const payload = await response.json().catch(() => null)
  if (response.status === 401) {
    throw new Error(
      "Non authentifié. Renseigne FLASHCARDS_COOKIE avec le cookie de session d'un compte connecté."
    )
  }
  if (!response.ok) throw new Error(payload?.error ?? `Erreur HTTP ${response.status}`)
  return payload
}

async function main() {
  const { options, file } = parseArgs(process.argv.slice(2))

  if (options.help || !file) {
    process.stdout.write(USAGE)
    process.exit(options.help ? 0 : 1)
  }

  const contents = await readFile(path.resolve(file), "utf8")
  // Un `.json` est envoyé tel quel ; tout le reste passe par le parseur de notes.
  const isJson = file.toLowerCase().endsWith(".json")
  const payload = isJson ? { json: contents } : { text: contents }
  const base = options.url.replace(/\/$/, "")

  if (options.dryRun) {
    const result = await post(`${base}/api/parse`, payload)
    const output = `${JSON.stringify(result.courses, null, 2)}\n`
    if (options.out) {
      await writeFile(path.resolve(options.out), output, "utf8")
      console.log(`✔ Écrit dans ${options.out}`)
    } else {
      process.stdout.write(output)
    }
    if (result.skipped?.length) {
      console.error(`\n⚠ ${result.skipped.length} ligne(s) non reconnue(s) :`)
      for (const line of result.skipped.slice(0, 10)) console.error(`   ${line}`)
    }
    return
  }

  const result = await post(`${base}/api/courses`, {
    ...payload,
    ...(options.title ? { title: options.title } : {}),
    ...(options.date ? { date: options.date } : {}),
  })

  for (const course of result.courses) {
    console.log(`✔ « ${course.title} » (${course.date}) — ${course.words.length} mots`)
    console.log(`  ${base}/courses/${course.id}`)
  }
  if (result.skipped?.length) {
    console.error(`⚠ ${result.skipped.length} ligne(s) ignorée(s).`)
  }
}

main().catch((error) => {
  console.error(`✖ ${error.message}`)
  process.exit(1)
})
