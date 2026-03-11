/**
 * Script to generate fallback questions JSON from iSAQB XML files.
 * Uses the shared xmlParser module for DRY parsing logic.
 *
 * Run: bun run scripts/generateFallback.ts
 */
import { parseQuestionXml } from '../src/data/xmlParser'

const GITHUB_API_URL = 'https://api.github.com/repos/isaqb-org/foundation-exam-questions/contents/mock/questions'
const RAW_BASE_URL = 'https://raw.githubusercontent.com/isaqb-org/foundation-exam-questions/main/mock/questions'

async function main() {
  // Discover question files dynamically
  console.log('Discovering question files via GitHub API...')
  const res = await fetch(GITHUB_API_URL)
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`)
  const entries: Array<{ name: string; type: string }> = await res.json()
  const filenames = entries
    .filter(e => e.type === 'file' && e.name.endsWith('.xml'))
    .map(e => e.name)
    .sort()

  console.log(`Found ${filenames.length} question files\n`)

  // linkedom DOMParser for server-side XML parsing
  const { DOMParser } = await import('linkedom')
  const domParser = new DOMParser() as unknown as globalThis.DOMParser

  const questions = []

  for (const filename of filenames) {
    console.log(`Fetching ${filename}...`)
    const xmlRes = await fetch(`${RAW_BASE_URL}/${filename}`)
    if (!xmlRes.ok) throw new Error(`HTTP ${xmlRes.status} for ${filename}`)
    const xml = await xmlRes.text()
    questions.push(parseQuestionXml(xml, domParser))
  }

  const outPath = new URL('../src/data/fallbackQuestions.json', import.meta.url).pathname
  await Bun.write(outPath, JSON.stringify(questions, null, 2))
  console.log(`\n✅ Generated ${questions.length} questions → ${outPath}`)
}

main().catch(console.error)
