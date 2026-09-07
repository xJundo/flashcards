import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Server-side fallback for a course's spoken-language audio.
 *
 * The browser's Web Speech API is tried first (see `useSpeech`); it is
 * instant and free, but many Linux/Chromium setups ship few or no non-English
 * voices. This route proxies Google Translate's public TTS endpoint for those
 * cases. It is an undocumented endpoint — treat it as best effort, not as a
 * guarantee.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const text = params.get("text")?.trim()
  const locale = params.get("locale")?.trim()
  if (!text)
    return NextResponse.json(
      { error: "Paramètre `text` manquant." },
      { status: 400 }
    )
  if (!locale)
    return NextResponse.json(
      { error: "Paramètre `locale` manquant." },
      { status: 400 }
    )
  if (text.length > 200) {
    return NextResponse.json(
      { error: "Texte trop long (200 caractères max)." },
      { status: 413 }
    )
  }

  // Google Translate's `tl` wants a bare language code, not a full locale.
  const language = locale.split("-")[0].toLowerCase()

  const upstream = new URL("https://translate.google.com/translate_tts")
  upstream.searchParams.set("ie", "UTF-8")
  upstream.searchParams.set("client", "tw-ob")
  upstream.searchParams.set("tl", language)
  upstream.searchParams.set("q", text)

  try {
    const response = await fetch(upstream, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        referer: "https://translate.google.com/",
      },
      cache: "no-store",
    })
    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: "Synthèse vocale indisponible." },
        { status: 502 }
      )
    }
    return new NextResponse(response.body, {
      headers: {
        "content-type": "audio/mpeg",
        // Same word, same audio: let the browser keep it for a day.
        "cache-control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Synthèse vocale indisponible." },
      { status: 502 }
    )
  }
}
