/**
 * Bind document ids from effect params. Never walk hydrated asset objects
 * (BRIEF.md §5.3 / AGENTS.md hard rule 8).
 */
import {extractDocumentId} from '@sanity/workflow-engine'

function localDocumentId(raw: string): string {
  if (
    raw.startsWith('dataset:') ||
    raw.startsWith('canvas:') ||
    raw.startsWith('media-library:') ||
    raw.startsWith('dashboard:')
  ) {
    return extractDocumentId(raw)
  }
  if (raw.includes(':') && !raw.startsWith('drafts.') && !raw.startsWith('versions.')) {
    return raw.slice(raw.lastIndexOf(':') + 1)
  }
  return raw
}

function assertDocumentId(raw: string): string {
  const id = localDocumentId(raw)
  if (id.startsWith('file-') || id.startsWith('image-')) {
    throw new Error(
      `Expected a document id, got asset id "${raw}". Bind $fields.subject._id, not a hydrated asset.`,
    )
  }
  return id
}

export function asDocumentId(value: unknown): string {
  if (!value) throw new Error('effect binding missing a document ref')
  if (typeof value === 'string') return assertDocumentId(value)

  const record = value as {_id?: string; id?: string; _ref?: string; _type?: string}
  if (record._id && record._type && record._type !== 'reference') {
    return assertDocumentId(record._id)
  }
  const raw = record._id ?? record.id ?? record._ref ?? ''
  if (!raw) throw new Error('effect binding had an empty document ref')
  return assertDocumentId(raw)
}
