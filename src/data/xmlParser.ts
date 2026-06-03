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

/**
 * Minimal structural shape of the DOM subset this parser touches. Declared locally
 * so the module is self-contained and typechecks identically everywhere it runs —
 * the browser, the Worker (@xmldom/xmldom) and Node (linkedom) each ship a different
 * ambient `Element`/`DOMParser`, and the Worker's tsconfig has no DOM lib at all.
 * `children`/`childNodes` are typed as `ArrayLike<unknown>` because each node is
 * narrowed by tag name before use; entries are cast to `XmlElement` at the call site.
 */
interface XmlElement {
  readonly tagName: string
  readonly localName: string | null
  readonly textContent: string | null
  readonly children?: ArrayLike<unknown>
  readonly childNodes: ArrayLike<unknown>
  getAttribute(qualifiedName: string): string | null
  getAttributeNS?(namespace: string, localName: string): string | null
  hasAttribute(qualifiedName: string): boolean
  getElementsByTagName(qualifiedName: string): ArrayLike<XmlElement>
}

interface XmlDocument {
  readonly documentElement: XmlElement | null
  getElementsByTagName(qualifiedName: string): ArrayLike<XmlElement>
}

/** Spec-compatible DOMParser subset — browser-native, @xmldom/xmldom or linkedom. */
export interface XmlDomParser {
  parseFromString(source: string, type: string): XmlDocument
}

interface BilingualTexts {
  de: string
  en: string
}

/**
 * Extract bilingual {de, en} text from a parent element
 * that contains `<text xml:lang="de">...</text>` children.
 */
export function getTexts(element: XmlElement | null): BilingualTexts {
  if (!element) return { de: '', en: '' }
  const result: BilingualTexts = { de: '', en: '' }

  for (const child of Array.from(element.children ?? element.childNodes)) {
    const el = child as XmlElement
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
function getFirstByTag(parent: XmlElement, tagName: string): XmlElement | null {
  const results = parent.getElementsByTagName(tagName)
  return results.length > 0 ? results[0] : null
}

/** Get all elements matching a tag name (recursive, like querySelectorAll) */
function getAllByTag(parent: XmlElement, tagName: string): XmlElement[] {
  const results = parent.getElementsByTagName(tagName)
  const out: XmlElement[] = []
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
export function parseQuestionXml(xmlText: string, domParser: XmlDomParser): Question {
  const doc = domParser.parseFromString(xmlText, 'text/xml')

  // Check for parse errors — browser uses <parsererror>, xmldom may throw
  const parseErrors = doc.getElementsByTagName('parsererror')
  if (parseErrors.length > 0) throw new Error(`XML parse error: ${parseErrors[0].textContent}`)

  const root = doc.documentElement
  if (!root) throw new Error('XML document has no root element')
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
