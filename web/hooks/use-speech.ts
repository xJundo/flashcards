"use client"

import * as React from "react"

import { stripRichText } from "@/lib/rich-text"

type SpeechState = {
  speak: (text: string) => void
  stop: () => void
  speaking: boolean
}

function findVoice(locale: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const lower = locale.toLowerCase()
  const primary = lower.split("-")[0]
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === lower) ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith(primary)) ??
    null
  )
}

const NO_OP: SpeechState = { speak: () => {}, stop: () => {}, speaking: false }

/**
 * Speaks a card's front text in the course's language, preferring the
 * browser's own voice for `locale` and falling back to `/api/tts` when the
 * platform has none (common on Linux and on some Android browsers). Voices
 * are looked up at speak time rather than cached: by the time the user
 * clicks, the browser has resolved its voice list.
 *
 * `locale` is `null` for a course with no spoken-language content — every
 * caller gets a harmless no-op back rather than having to guard each call.
 */
export function useSpeech(locale: string | null): SpeechState {
  const [speaking, setSpeaking] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const stop = React.useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis)
      window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(false)
  }, [])

  const speakOnServer = React.useCallback(
    (text: string, activeLocale: string) => {
      const audio = new Audio(
        `/api/tts?text=${encodeURIComponent(text)}&locale=${encodeURIComponent(activeLocale)}`
      )
      audioRef.current = audio
      setSpeaking(true)
      audio.addEventListener("ended", () => setSpeaking(false))
      audio.addEventListener("error", () => setSpeaking(false))
      void audio.play().catch(() => setSpeaking(false))
    },
    []
  )

  const speak = React.useCallback(
    (text: string) => {
      if (!locale) return
      // Strip arrows used in conjugation notes (e.g. "오다 → 와요"): they get
      // read aloud as "flèche" instead of being skipped. Rich-text markup
      // (`**bold**`, `==color:text==`) is stripped the same way — a voice
      // has no use for it either.
      const value = stripRichText(text)
        .replace(/[→←↔⇒⇐⇔]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      if (!value) return
      stop()

      const voice = findVoice(locale)
      if (!voice) {
        speakOnServer(value, locale)
        return
      }

      const utterance = new SpeechSynthesisUtterance(value)
      utterance.voice = voice
      utterance.lang = voice.lang || locale
      utterance.rate = 0.9
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => {
        setSpeaking(false)
        speakOnServer(value, locale)
      }
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
    },
    [locale, speakOnServer, stop]
  )

  React.useEffect(() => stop, [stop])

  return locale ? { speak, stop, speaking } : NO_OP
}
