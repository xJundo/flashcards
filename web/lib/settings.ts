"use client"

import * as React from "react"

import type { SeriesSettings } from "@/lib/types"

const SETTINGS_KEY = "flashcards:settings"

/**
 * What the learner chose last time. The draw settings are the ones the launch
 * screen shows; `autoplay` and `romanization` are comfort toggles that stay
 * live during a series, so changing them must never redraw the deck.
 */
export type Settings = SeriesSettings & {
  autoplay: boolean
  romanization: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  frontSide: "korean",
  shuffled: true,
  source: "all",
  size: null,
  autoplay: false,
  romanization: true,
}

/**
 * Preferences live in `localStorage`, which is an external store rather than
 * React state — reading it through `useSyncExternalStore` keeps the value
 * available during render (no post-mount effect, no hydration mismatch).
 * The snapshot is memoised because React compares it by identity.
 */
const store = (() => {
  let snapshot: Settings | null = null
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get(): Settings {
      if (snapshot) return snapshot
      let loaded = DEFAULT_SETTINGS
      try {
        const stored = window.localStorage.getItem(SETTINGS_KEY)
        if (stored) loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      } catch {
        // Corrupted or unavailable storage: the defaults are fine.
      }
      snapshot = loaded
      return loaded
    },
    getServer(): Settings {
      return DEFAULT_SETTINGS
    },
    set(next: Settings) {
      snapshot = next
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Ignore quota / private-mode failures; the session still uses `next`.
      }
      for (const listener of listeners) listener()
    },
  }
})()

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = React.useSyncExternalStore(
    store.subscribe,
    store.get,
    store.getServer
  )
  const update = React.useCallback(
    (patch: Partial<Settings>) => store.set({ ...store.get(), ...patch }),
    []
  )
  return [settings, update]
}
