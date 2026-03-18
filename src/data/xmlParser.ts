/**
 * Shared XML parsing logic — used by both the client-side loader (browser DOMParser)
 * and the Cloudflare Worker (@xmldom/xmldom DOMParser).
 *
 * This module only deals with extracting data from a parsed Document,
 * so it works with any spec-compatible DOMParser implementation.
 *
 * NOTE: We use getElementsByTagName instead of querySelector/querySelectorAll
 * because @xmldom/xmldom does not implement the Selectors API.
 */
import type { Question } from './schema'

interface BilingualTexts {
  de: string
  en: string
}

/**
 * Extract bilingual {de, en} text from a parent element
 * that contains `<text xml:lang="de">...</text>` children.
 */
export function getTexts(element: Element | null): BilingualTexts {
  if (!element) return { de: '', en: '' }
  const result: BilingualTexts = { de: '', en: '' }

  for (const child of Array.from(element.children ?? element.childNodes)) {
    const el = child as Element
    if (el.localName === 'text' || el.tagName === 'text') {
      const lang =
        el.getAttribute('xml:lang') ??
        el.getAttributeNS?.('http://www.w3.org/XML/1998/namespace', 'lang') ??
        null
      if (lang === 'de' || lang === 'en') {
        result[lang] = el.textContent?.trim() ?? ''
      }
    }
  }
  return result
}

/** Get the first element matching a tag name (recursive, like querySelector) */
function getFirstByTag(parent: Element, tagName: string): Element | null {
  const results = parent.getElementsByTagName(tagName)
  return results.length > 0 ? results[0] : null
}

/** Get all elements matching a tag name (recursive, like querySelectorAll) */
function getAllByTag(parent: Element, tagName: string): Element[] {
  const results = parent.getElementsByTagName(tagName)
  const out: Element[] = []
  for (let i = 0; i < results.length; i++) {
    out.push(results[i])
  }
  return out
}

/**
 * Parse a single XML string into a typed Question object.
 * Accepts a DOMParser instance so the caller can provide either
 * the browser-native DOMParser or @xmldom/xmldom's equivalent.
 */
export function parseQuestionXml(xmlText: string, domParser: DOMParser): Question {
  const doc = domParser.parseFromString(xmlText, 'text/xml')

  // Check for parse errors — browser uses <parsererror>, xmldom may throw
  const parseErrors = doc.getElementsByTagName('parsererror')
  if (parseErrors.length > 0) throw new Error(`XML parse error: ${parseErrors[0].textContent}`)

  const root = doc.documentElement
  const tagName = root.localName
  const id = root.getAttribute('id') ?? ''
  const points = parseInt(root.getAttribute('points') ?? '1', 10)

  const lgs = getAllByTag(root, 'lg')
    .map(lg => lg.getAttribute('lg'))
    .filter(Boolean) as string[]

  const stem = getTexts(getFirstByTag(root, 'stem'))
  const explanation = getTexts(getFirstByTag(root, 'explanation'))

  if (tagName === 'pickQuestion') {
    const options = getAllByTag(root, 'option').map(opt => ({
      id: opt.getAttribute('identifier') ?? '',
      text: getTexts(opt),
      correct: opt.hasAttribute('correct'),
    }))
    return { id, type: 'pick' as const, points, stem, options, explanation, lgs }
  }

  if (tagName === 'categoryQuestion') {
    const categories = getAllByTag(root, 'category').map(cat => ({
      label: cat.getAttribute('label') ?? '',
      text: getTexts(cat),
    }))
    const statements = getAllByTag(root, 'statement').map(stmt => ({
      id: stmt.getAttribute('identifier') ?? '',
      text: getTexts(stmt),
      correctCategory: stmt.getAttribute('correctCategory') ?? '',
    }))
    return { id, type: 'category' as const, points, stem, categories, statements, explanation, lgs }
  }

  throw new Error(`Unknown question type: ${tagName}`)
}
