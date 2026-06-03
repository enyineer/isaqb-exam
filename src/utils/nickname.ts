/**
 * Shared nickname validation — used by the guest-join form (frontend) and the
 * session submit handler (Worker, authoritative). Single source of truth so both
 * sides agree on what counts as a valid display name.
 *
 * Policy ("minimal"): 1-50 characters after trimming, with no control, invisible,
 * or bidirectional-format characters. International names (umlauts, accents, CJK,
 * emoji) are intentionally allowed - every render path is XSS-safe via React, so
 * this is data hygiene against spoofing/corruption, not HTML sanitization.
 */

export const MAX_NICKNAME_LENGTH = 50

/**
 * A code point that is invisible and can be used to spoof or corrupt a displayed
 * name: C0/C1 controls + DEL, zero-width characters, line/paragraph separators,
 * and bidirectional/format characters. Checked numerically to avoid embedding raw
 * control characters in source.
 */
function isDisallowedCodePoint(c: number): boolean {
  return (
    c <= 0x1f ||                    // C0 controls (incl. tab, CR, LF)
    (c >= 0x7f && c <= 0x9f) ||     // DEL + C1 controls
    (c >= 0x200b && c <= 0x200f) || // zero-width chars + LRM/RLM
    c === 0x2028 || c === 0x2029 || // line / paragraph separators
    (c >= 0x202a && c <= 0x202e) || // bidi embeddings / overrides
    (c >= 0x2060 && c <= 0x2064) || // word joiner + invisible math operators
    (c >= 0x2066 && c <= 0x206f) || // bidi isolates + deprecated format chars
    c === 0xfeff                    // BOM / zero-width no-break space
  )
}

/** True if `raw` is an acceptable nickname. Validation operates on the trimmed value. */
export function isValidNickname(raw: string): boolean {
  const value = raw.trim()
  if (value.length < 1 || value.length > MAX_NICKNAME_LENGTH) return false
  for (const ch of value) {
    if (isDisallowedCodePoint(ch.codePointAt(0) ?? 0)) return false
  }
  return true
}
