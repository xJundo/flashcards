import "server-only"

/**
 * A text-based SVG can't be told apart by magic bytes: it must open with an
 * `<svg` root (after an optional BOM, XML prolog, doctype or comments), and
 * anything able to run code is refused. Served with a sandboxing CSP on top —
 * see the card image route — this is defense in depth, not the only barrier.
 */
function isSafeSvg(data: Buffer): boolean {
  const source = data.toString("utf8")
  const head = source
    .replace(/^\uFEFF/, "")
    .replace(/^\s*(<\?xml[^>]*\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->|\s)*/i, "")
  if (!/^<svg[\s>]/i.test(head)) return false
  return !/<script|<foreignObject|<iframe|<embed|<object|\son\w+\s*=|javascript:/i.test(
    source
  )
}

/**
 * Sniffs the handful of image formats this app accepts, from the file's magic
 * bytes. SVG is opt-in (`svg: true`): only card pictures serve it safely.
 */
export function sniffImage(
  data: Buffer,
  { svg = false }: { svg?: boolean } = {}
): string | null {
  if (
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png"
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return "image/jpeg"
  if (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp"
  if (["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("ascii")))
    return "image/gif"
  if (svg && isSafeSvg(data)) return "image/svg+xml"
  return null
}
