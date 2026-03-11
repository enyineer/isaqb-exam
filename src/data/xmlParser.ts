/**
 * Shared XML parsing logic — used by both the client-side loader (browser DOMParser)
 * and the generate script (linkedom DOMParser).
 *
 * This module only deals with extracting data from a parsed Document,
 * so it works with any spec-compatible DOMParser implementation.
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

  for (const child of Array.from(element.children)) {
    if (child.localName === 'text' || child.tagName === 'text') {
      const lang =
        child.getAttribute('xml:lang') ??
        child.getAttributeNS?.('http://www.w3.org/XML/1998/namespace', 'lang') ??
        null
      if (lang === 'de' || lang === 'en') {
        result[lang] = child.textContent?.trim() ?? ''
      }
    }
  }
  return result
}

/**
 * Parse a single XML string into a typed Question object.
 * Accepts a DOMParser instance so the caller can provide either
 * the browser-native DOMParser or linkedom's equivalent.
 */
export function parseQuestionXml(xmlText: string, domParser: DOMParser): Question {
  const doc = domParser.parseFromString(xmlText, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error(`XML parse error: ${parseError.textContent}`)

  const root = doc.documentElement
  const tagName = root.localName
  const id = root.getAttribute('id') ?? ''
  const points = parseInt(root.getAttribute('points') ?? '1', 10)

  const lgs = Array.from(root.querySelectorAll('lg'))
    .map(lg => lg.getAttribute('lg'))
    .filter(Boolean) as string[]

  const stem = getTexts(root.querySelector('stem'))
  const explanation = getTexts(root.querySelector('explanation'))

  if (tagName === 'pickQuestion') {
    const options = Array.from(root.querySelectorAll('option')).map(opt => ({
      id: opt.getAttribute('identifier') ?? '',
      text: getTexts(opt),
      correct: opt.hasAttribute('correct'),
    }))
    return { id, type: 'pick' as const, points, stem, options, explanation, lgs }
  }

  if (tagName === 'categoryQuestion') {
    const categories = Array.from(root.querySelectorAll('category')).map(cat => ({
      label: cat.getAttribute('label') ?? '',
      text: getTexts(cat),
    }))
    const statements = Array.from(root.querySelectorAll('statement')).map(stmt => ({
      id: stmt.getAttribute('identifier') ?? '',
      text: getTexts(stmt),
      correctCategory: stmt.getAttribute('correctCategory') ?? '',
    }))
    return { id, type: 'category' as const, points, stem, categories, statements, explanation, lgs }
  }

  throw new Error(`Unknown question type: ${tagName}`)
}
