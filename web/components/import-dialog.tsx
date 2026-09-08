"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CopyIcon, UploadIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RichText } from "@/components/rich-text"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { HIGHLIGHT_KEYS } from "@/lib/colors"
import type { Card, Course } from "@/lib/types"

const JSON_PLACEHOLDER = `[
  { "mot": "안녕하세요", "prononciation": "annyeonghaseyo", "traduction": "bonjour" },
  { "mot": "감사합니다", "prononciation": "gamsahamnida", "traduction": "merci",
    "note_additionnelle": "Registre poli" }
]`

const TEXT_PLACEHOLDER = `안녕하세요 - annyeonghaseyo - bonjour
감사합니다 | gamsahamnida | merci
사랑 (sarang) : amour`

/**
 * The full shape the JSON importer accepts, meant to be copied and handed
 * to an AI so it generates a course directly in this format. Field aliases
 * (mot/korean/word…) live in `lib/normalize.ts` — only the canonical names
 * are documented here to keep this readable.
 */
const JSON_SCHEMA = `{
  "title": string,   // Titre du cours. Optionnel : sinon "Cours du <date>".
  "date": "AAAA-MM-JJ",   // Optionnel : sinon aujourd'hui.
  "words": [
    {
      "front": string,      // Recto (le mot coréen).
      "phonetic": string,   // Indice de prononciation (romanisation).
      "back": string,       // Verso (la traduction).
      "note": string,       // Optionnel : note affichée sous le verso.
      "align": "left" | "center" | "right" | "justify"
        // Optionnel, "center" par défaut. Alignement du verso et de la note.
    }
  ]
}

// Plusieurs cours dans un seul fichier : un tableau de ce même objet.

// Mise en forme, utilisable dans "front", "back" et "note" :
//   **texte**              -> gras
//   ==couleur:texte==      -> surligné (couleur : ${HIGHLIGHT_KEYS.join(", ")})
//   ==couleur:**texte**==  -> gras + surligné (uniquement dans cet ordre)`

type Preview = {
  courses: { title?: string; date?: string; words: Card[] }[]
  skipped: string[]
  /** Set when the parse call itself failed (invalid JSON, server error…). */
  error?: string
}

export function ImportDialog({
  spaceId,
  folderId = null,
  children,
}: {
  spaceId: string
  folderId?: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [schemaOpen, setSchemaOpen] = React.useState(false)
  const [mode, setMode] = React.useState("json")
  const [json, setJson] = React.useState("")
  const [text, setText] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [date, setDate] = React.useState("")
  /** Once the user edits a field by hand, detection stops overwriting it. */
  const titleTouched = React.useRef(false)
  const dateTouched = React.useRef(false)
  /** Tagged with the input it was computed from, so a stale result never shows. */
  const [parsed, setParsed] = React.useState<{
    source: string
    data: Preview
  } | null>(null)
  const [pending, setPending] = React.useState(false)

  const source = mode === "json" ? json : text
  const preview = parsed?.source === source ? parsed.data : null
  const payload = React.useMemo(
    () => (mode === "json" ? { json } : { text }),
    [json, mode, text]
  )
  // The title/date overrides only apply server-side when the payload
  // resolves to a single course (see `courses/route.ts`) — with several,
  // each keeps its own detected title/date and these inputs would be no-ops.
  const singleCourse =
    preview && preview.courses.length === 1 ? preview.courses[0] : undefined
  const multipleCourses = Boolean(preview && preview.courses.length > 1)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setJson("")
      setText("")
      setTitle("")
      setDate("")
      setParsed(null)
      titleTouched.current = false
      dateTouched.current = false
    }
    setOpen(next)
  }

  // Reflects the detected title/date into the inputs as soon as they're
  // known, without clobbering anything the user already typed by hand.
  React.useEffect(() => {
    if (!titleTouched.current && singleCourse?.title) setTitle(singleCourse.title)
    if (!dateTouched.current && singleCourse?.date) setDate(singleCourse.date)
  }, [singleCourse?.title, singleCourse?.date])

  // Live preview: debounced so typing stays responsive.
  React.useEffect(() => {
    if (!source.trim()) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const data = await api<Preview>("/api/parse", {
          method: "POST",
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        setParsed({ source, data })
      } catch (error) {
        if (!controller.signal.aborted) {
          setParsed({
            source,
            data: {
              courses: [],
              skipped: [],
              error:
                error instanceof Error ? error.message : "Analyse impossible.",
            },
          })
        }
      }
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [payload, source])

  const wordCount =
    preview?.courses.reduce(
      (total, course) => total + course.words.length,
      0
    ) ?? 0
  const imageCount =
    preview?.courses.reduce(
      (total, course) =>
        total +
        course.words.filter((word) => word.frontImage || word.backImage)
          .length,
      0
    ) ?? 0

  async function readFile(file: File | undefined) {
    if (!file) return
    const contents = await file.text()
    if (file.name.endsWith(".json")) {
      setMode("json")
      setJson(contents)
    } else {
      setMode("text")
      setText(contents)
    }
  }

  async function submit() {
    setPending(true)
    try {
      const { courses } = await api<{ courses: Course[] }>("/api/courses", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          title: title || undefined,
          date: date || undefined,
          spaceId,
          folderId,
        }),
      })
      toast.add({
        title:
          courses.length > 1
            ? `${courses.length} cours importés`
            : "Cours importé",
        description: `${courses.reduce((total, course) => total + course.cards.length, 0)} mots ajoutés.`,
        type: "success",
      })
      handleOpenChange(false)
      if (courses.length === 1) router.push(`/courses/${courses[0].id}`)
      else router.refresh()
    } catch (error) {
      toast.add({
        title: "Import impossible",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      {/* The three rows are header / scrollable body / footer, so the actions stay
          reachable however long the preview gets. */}
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer un cours</DialogTitle>
          <DialogDescription>
            Colle du JSON, ou directement le texte brut copié depuis Google
            Docs. Un JSON exporté depuis cette appli réimporte aussi ses
            images.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex flex-col gap-4 overflow-y-auto px-1">
          <Tabs value={mode} onValueChange={(value) => setMode(String(value))}>
            <div className="flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="text">Texte brut</TabsTrigger>
              </TabsList>
              {mode === "json" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSchemaOpen(true)}
                >
                  Voir le schéma
                </Button>
              )}
            </div>
            <TabsContent value="json">
              <Textarea
                value={json}
                onChange={(event) => setJson(event.target.value)}
                placeholder={JSON_PLACEHOLDER}
                className="min-h-40 font-mono text-xs"
                spellCheck={false}
              />
            </TabsContent>
            <TabsContent value="text">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={TEXT_PLACEHOLDER}
                className="min-h-40 text-sm"
                spellCheck={false}
              />
            </TabsContent>
          </Tabs>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="import-file">
                Ou depuis un fichier
              </FieldLabel>
              <Input
                id="import-file"
                type="file"
                accept=".json,.txt,.md,.csv,text/plain,application/json"
                onChange={(event) => void readFile(event.target.files?.[0])}
              />
              <FieldDescription>
                `.json` part dans l&apos;onglet JSON, tout le reste dans « Texte
                brut ».
              </FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="import-title">
                  Titre (facultatif)
                </FieldLabel>
                <Input
                  id="import-title"
                  value={title}
                  onChange={(event) => {
                    titleTouched.current = true
                    setTitle(event.target.value)
                  }}
                  disabled={multipleCourses}
                  placeholder="Détecté depuis la note"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="import-date">Date (facultatif)</FieldLabel>
                <Input
                  id="import-date"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    dateTouched.current = true
                    setDate(event.target.value)
                  }}
                  disabled={multipleCourses}
                />
              </Field>
              {multipleCourses && (
                <FieldDescription className="sm:col-span-2">
                  Plusieurs cours détectés : chacun garde son propre titre et
                  sa propre date.
                </FieldDescription>
              )}
            </div>
          </FieldGroup>

          {preview && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={wordCount > 0 ? "default" : "secondary"}>
                  {wordCount} mot{wordCount > 1 ? "s" : ""} détecté
                  {wordCount > 1 ? "s" : ""}
                </Badge>
                {preview.courses.length > 1 && (
                  <Badge variant="secondary">
                    {preview.courses.length} cours
                  </Badge>
                )}
                {imageCount > 0 && (
                  <Badge variant="secondary">
                    {imageCount} image{imageCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {preview.skipped.length > 0 && (
                  <Badge variant="secondary">
                    {preview.skipped.length} ligne(s) ignorée(s)
                  </Badge>
                )}
              </div>
              {wordCount === 0 && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {preview.error ?? "Aucun mot n'a pu être lu"}
                  </AlertTitle>
                  <AlertDescription>
                    {mode === "json"
                      ? "Attendu : un tableau d'objets avec un champ pour le mot coréen (mot / korean / word), la prononciation (prononciation / romanization) et la traduction (traduction / translation), plus une note facultative (note / note_additionnelle). Les cours imbriqués sous une autre clé sont détectés automatiquement."
                      : "Attendu : une ligne par mot, colonnes séparées par -, |, :, / ou une tabulation."}
                  </AlertDescription>
                </Alert>
              )}
              {wordCount > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody>
                      {preview.courses
                        .flatMap((course) => course.words.slice(0, 50))
                        .map((word) => (
                          <tr
                            key={word.id}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-3 py-1.5 font-medium">
                              <RichText text={word.front} />
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {word.phonetic}
                            </td>
                            <td className="px-3 py-1.5">
                              <RichText text={word.back} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              {preview.skipped.length > 0 && (
                <Alert>
                  <AlertTitle>Lignes non reconnues</AlertTitle>
                  <AlertDescription>
                    {preview.skipped.slice(0, 3).join(" · ")}
                    {preview.skipped.length > 3 ? " …" : ""}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
          >
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending || wordCount === 0}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UploadIcon data-icon="inline-start" />
            )}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
      <Dialog open={schemaOpen} onOpenChange={setSchemaOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Schéma JSON</DialogTitle>
            <DialogDescription>
              À copier-coller dans une IA pour lui faire générer un cours dans
              le bon format.
            </DialogDescription>
          </DialogHeader>
          <pre className="-mx-1 overflow-auto rounded-lg border bg-muted/50 px-3 py-2.5 text-xs">
            {JSON_SCHEMA}
          </pre>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSchemaOpen(false)}
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(JSON_SCHEMA)
                toast.add({ title: "Schéma copié", type: "success" })
              }}
            >
              <CopyIcon data-icon="inline-start" />
              Copier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
