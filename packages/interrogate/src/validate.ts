/**
 * Drop evidence whose excerpt is not an exact substring of page content (autopsy parity).
 */
import {pageTextCorpus} from './pageText'
import type {DraftQuestion, InterrogatePageInput} from './types'

function pageTextById(pages: InterrogatePageInput[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const page of pages) {
    const published = page._id.replace(/^drafts\./, '')
    const text = pageTextCorpus(page)
    map.set(page._id, text)
    map.set(published, text)
  }
  return map
}

export function filterQuestionEvidence(
  questions: DraftQuestion[],
  pages: InterrogatePageInput[],
): DraftQuestion[] {
  const texts = pageTextById(pages)
  return questions
    .map((q) => {
      const evidence = q.evidence.filter((ev) => {
        const haystack = texts.get(ev.pageId) ?? ''
        return ev.excerpt.length > 0 && haystack.includes(ev.excerpt)
      })
      return {...q, evidence}
    })
    .filter((q) => q.evidence.length > 0)
}
