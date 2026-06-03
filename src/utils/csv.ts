/**
 * CSV helpers (RFC 4180) with spreadsheet formula-injection neutralization.
 *
 * User-supplied values such as participant names can contain commas, quotes or
 * newlines (which corrupt columns) or a leading =/+/-/@ that Excel and Google
 * Sheets execute as a formula when the exported file is opened. Both are handled
 * here so callers can build CSV rows safely.
 */

/** Leading characters that trigger formula evaluation in spreadsheet apps. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

/** Characters that require the field to be wrapped in double quotes per RFC 4180. */
const NEEDS_QUOTING = /[",\r\n]/

/** Escape a single value for safe inclusion in a CSV cell. */
export function escapeCsvField(value: string | number | boolean): string {
  let s = String(value)
  // Neutralize formula injection by prefixing a single quote (OWASP guidance).
  if (FORMULA_TRIGGER.test(s)) s = `'${s}`
  // RFC 4180: quote fields containing a comma, quote, CR or LF; double inner quotes.
  if (NEEDS_QUOTING.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/** Join a row of values into a CSV line with each field escaped. */
export function toCsvRow(fields: Array<string | number | boolean>): string {
  return fields.map(escapeCsvField).join(',')
}
