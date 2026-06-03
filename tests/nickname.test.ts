/**
 * Tests for shared nickname validation (src/utils/nickname.ts).
 * Control/invisible characters are built via String.fromCharCode to keep the
 * source readable and free of raw control bytes.
 */

import { describe, it, expect } from 'bun:test'
import { isValidNickname, MAX_NICKNAME_LENGTH } from '../src/utils/nickname'

describe('isValidNickname', () => {
  it('accepts normal and international names', () => {
    for (const n of ['Bob', 'Schüler', 'José', '山田太郎', 'a', '😀 Nina']) {
      expect(isValidNickname(n)).toBe(true)
    }
  })

  it('trims before validating', () => {
    expect(isValidNickname('  Bob  ')).toBe(true)
    expect(isValidNickname('   ')).toBe(false)
    expect(isValidNickname('')).toBe(false)
  })

  it('enforces the max length on the trimmed value', () => {
    expect(isValidNickname('a'.repeat(MAX_NICKNAME_LENGTH))).toBe(true)
    expect(isValidNickname('a'.repeat(MAX_NICKNAME_LENGTH + 1))).toBe(false)
    expect(isValidNickname(`  ${'a'.repeat(MAX_NICKNAME_LENGTH)}  `)).toBe(true)
  })

  it('rejects control, newline and tab characters', () => {
    expect(isValidNickname('Bob' + String.fromCharCode(0x00))).toBe(false)
    expect(isValidNickname('Bob' + String.fromCharCode(0x0a) + 'Smith')).toBe(false) // LF
    expect(isValidNickname('Bob' + String.fromCharCode(0x09) + 'Smith')).toBe(false) // tab
    expect(isValidNickname('Bob' + String.fromCharCode(0x7f))).toBe(false)           // DEL
  })

  it('rejects zero-width and bidirectional format characters', () => {
    expect(isValidNickname('Bo' + String.fromCharCode(0x200b) + 'b')).toBe(false) // zero-width space
    expect(isValidNickname('Bob' + String.fromCharCode(0x202e))).toBe(false)      // RLO bidi override
    expect(isValidNickname('Bob' + String.fromCharCode(0x2066))).toBe(false)      // LRI bidi isolate
    // U+FEFF placed in the interior: a trailing one is stripped by String.trim().
    expect(isValidNickname('Bo' + String.fromCharCode(0xfeff) + 'b')).toBe(false) // BOM / ZWNBSP
  })
})
