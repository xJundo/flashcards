"use client"

import * as React from "react"

import { api } from "@/lib/api"
import type { Progress, RunFront } from "@/lib/types"

const EMPTY: Progress = { stats: {}, runs: [] }

type Action =
  | {
      run: {
        failed: string[]
        known: string[]
        size: number
        completed: boolean
        frontSide: RunFront
      }
    }
  | { acquired: string }
  | { review: string }
  | { deleteRun: string }
  | { clearRuns: true }

type ProgressBag = {
  progress: Progress
  send: (action: Action) => Promise<void>
}

/**
 * Progress lives in Postgres, one row set per account: it follows the learner
 * from one device to the next, and stays invisible to everyone else. Signed-out
 * visitors can revise, but nothing is recorded — hence `enabled`.
 */
export function useProgress(courseId: string, enabled: boolean): ProgressBag {
  const [loaded, setLoaded] = React.useState<Progress>(EMPTY)

  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    api<Progress>(`/api/courses/${courseId}/progress`)
      .then((fresh) => {
        if (!cancelled) setLoaded(fresh)
      })
      .catch(() => {
        // Offline or logged out mid-session: the deck still works untracked.
      })
    return () => {
      cancelled = true
    }
  }, [courseId, enabled])

  const send = React.useCallback(
    async (action: Action) => {
      if (!enabled) return
      try {
        setLoaded(
          await api<Progress>(`/api/courses/${courseId}/progress`, {
            method: "POST",
            body: JSON.stringify(action),
          })
        )
      } catch {
        // A lost update is not worth interrupting a revision session for.
      }
    },
    [courseId, enabled]
  )

  // Signed out, there is nothing to show even if a previous account left state
  // behind in this component instance.
  return { progress: enabled ? loaded : EMPTY, send }
}

const ProgressContext = React.createContext<ProgressBag>({
  progress: EMPTY,
  send: async () => {},
})

/**
 * One copy of the progress for the whole lesson page. The word list and the
 * revision panels sit in different sections but read the same standings, so a
 * finished series has to recolour both at once — two hooks would leave the
 * table showing what was true before the series.
 */
export function ProgressProvider({
  courseId,
  signedIn,
  children,
}: {
  courseId: string
  signedIn: boolean
  children: React.ReactNode
}) {
  const bag = useProgress(courseId, signedIn)
  return (
    <ProgressContext.Provider value={bag}>{children}</ProgressContext.Provider>
  )
}

/** Empty outside a {@link ProgressProvider} — untracked, never broken. */
export function useCourseProgress(): ProgressBag {
  return React.useContext(ProgressContext)
}
