/**
 * Tests for CSV escaping (src/utils/csv.ts) — RFC 4180 quoting plus
 * spreadsheet formula-injection neutralization.
 */

import { describe, it, expect } from 'bun:test'
import { escapeCsvField, toCsvRow } from '../src/utils/csv'

const LF = String.fromCharCode(0x0a)

describe('escapeCsvField', () => {
  it('leaves simple values unchanged', () => {
    expect(escapeCsvField('Bob')).toBe('Bob')
    expect(escapeCsvField(42)).toBe('42')
    expect(escapeCsvField(true)).toBe('true')
  })

  it('quotes fields containing commas, quotes or newlines', () => {
    expect(escapeCsvField('Doe, John')).toBe('"Doe, John"')
    expect(escapeCsvField('a"b')).toBe('"a""b"')
    expect(escapeCsvField('line1' + LF + 'line2')).toBe('"line1' + LF + 'line2"')
  })

  it('neutralizes spreadsheet formula injection', () => {
    expect(escapeCsvField('=1+1')).toBe("'=1+1")
    expect(escapeCsvField('+SUM(A1)')).toBe("'+SUM(A1)")
    expect(escapeCsvField('-2')).toBe("'-2")
    expect(escapeCsvField('@cmd')).toBe("'@cmd")
  })

  it('applies both formula-neutralization and RFC-4180 quoting', () => {
    // leading '=' adds the quote-prefix; the comma forces the field to be quoted
    expect(escapeCsvField('=HYPERLINK(x), y')).toBe('"\'=HYPERLINK(x), y"')
  })
})

describe('toCsvRow', () => {
  it('escapes each field and joins with commas', () => {
    expect(toCsvRow(['Doe, John', 'github', 10])).toBe('"Doe, John",github,10')
  })
})
