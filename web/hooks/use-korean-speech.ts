"use client"

import * as React from "react"

type SpeechState = {
  speak: (text: string) => void
  stop: () => void
  speaking: boolean
}

function findKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("ko")) ?? null
  )
}

/**
 * Speaks Korean, preferring the browser's own `ko-KR` voice and falling back to
 * `/api/tts` when the platform has none (common on Linux and on some Android
 * browsers). Voices are looked up at speak time rather than cached: by the time
 * the user clicks, the browser has resolved its voice list.
 */
export function useKoreanSpeech(): SpeechState {
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

  const speakOnServer = React.useCallback((text: string) => {
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}`)
    audioRef.current = audio
    setSpeaking(true)
    audio.addEventListener("ended", () => setSpeaking(false))
    audio.addEventListener("error", () => setSpeaking(false))
    void audio.play().catch(() => setSpeaking(false))
  }, [])

  const speak = React.useCallback(
    (text: string) => {
      const value = text.trim()
      if (!value) return
      stop()

      const voice = findKoreanVoice()
      if (!voice) {
        speakOnServer(value)
        return
      }

      const utterance = new SpeechSynthesisUtterance(value)
      utterance.voice = voice
      utterance.lang = voice.lang || "ko-KR"
      utterance.rate = 0.9
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => {
        setSpeaking(false)
        speakOnServer(value)
      }
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
    },
    [speakOnServer, stop]
  )

  React.useEffect(() => stop, [stop])

  return { speak, stop, speaking }
}
