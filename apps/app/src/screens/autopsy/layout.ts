import type {ProposedTypeRow} from './types'
import {classifyNode, isVisibleType} from './types'

export type NodeLayout = {
  key: string
  name: string
  x: number
  y: number
  w: number
  h: number
  kind: ReturnType<typeof classifyNode>
}

export type EdgeLayout = {
  from: string
  to: string
  style: 'body' | 'ref' | 'chrome'
}

const CANVAS_W = 920
const COL_GAP = 24
const ROW_GAP = 28

/**
 * Deterministic Autopsy layout (no physics).
 * Singletons top-right; Bones as a mid strip; documents in rows by evidence count.
 */
export function layoutTypes(types: ProposedTypeRow[]): {nodes: NodeLayout[]; edges: EdgeLayout[]} {
  const visible = types.filter(isVisibleType)
  const singletons = visible.filter((t) => classifyNode(t) === 'singleton')
  const bones = visible.filter((t) => classifyNode(t) === 'bones')
  const objects = visible.filter((t) => classifyNode(t) === 'object')
  const documents = visible
    .filter((t) => classifyNode(t) === 'document')
    .sort((a, b) => evidenceScore(b) - evidenceScore(a))

  const nodes: NodeLayout[] = []

  // Singletons pinned top-right, stacked.
  singletons.forEach((t, i) => {
    nodes.push({
      key: t._key || t.name || `s${i}`,
      name: t.name || 'singleton',
      x: CANVAS_W - 220,
      y: 24 + i * 88,
      w: 200,
      h: 72,
      kind: 'singleton',
    })
  })

  // Bones strip across the middle.
  bones.forEach((t, i) => {
    nodes.push({
      key: t._key || t.name || `b${i}`,
      name: t.name || t.bonesMatch || 'bone',
      x: 24 + i * (140 + 12),
      y: 168,
      w: 140,
      h: 56,
      kind: 'bones',
    })
  })

  // Custom objects sit under bones if any.
  objects.forEach((t, i) => {
    nodes.push({
      key: t._key || t.name || `o${i}`,
      name: t.name || 'object',
      x: 24 + i * (180 + COL_GAP),
      y: bones.length ? 248 : 168,
      w: 180,
      h: 64,
      kind: 'object',
    })
  })

  // Documents in rows of 4, sorted by evidence.
  const docY0 = bones.length || objects.length ? 320 : 168
  const perRow = 4
  documents.forEach((t, i) => {
    const col = i % perRow
    const row = Math.floor(i / perRow)
    nodes.push({
      key: t._key || t.name || `d${i}`,
      name: t.name || 'document',
      x: 24 + col * (200 + COL_GAP),
      y: docY0 + row * (80 + ROW_GAP),
      w: 200,
      h: 80,
      kind: 'document',
    })
  })

  const byName = new Map(nodes.map((n) => [n.name, n]))
  const edges: EdgeLayout[] = []

  for (const t of visible) {
    const from = t.name
    if (!from || !byName.has(from)) continue
    for (const f of t.fields ?? []) {
      const targets = [...(f.to ?? []), ...(f.of ?? [])]
      for (const target of targets) {
        if (!target || !byName.has(target) || target === from) continue
        const style =
          f.name === 'body' || (f.type === 'array' && (f.of ?? []).some((x) => x !== 'reference'))
            ? 'body'
            : target === 'siteSettings'
              ? 'chrome'
              : 'ref'
        edges.push({from, to: target, style})
      }
    }
  }

  return {nodes, edges}
}

function evidenceScore(t: ProposedTypeRow): number {
  const fromEvidence = t.evidence?.length ?? 0
  const fromFields = (t.fields ?? []).reduce((n, f) => n + (f.evidenceCount ?? 0), 0)
  return Math.max(fromEvidence, fromFields)
}

export function canvasHeight(nodes: NodeLayout[]): number {
  if (!nodes.length) return 360
  return Math.max(360, ...nodes.map((n) => n.y + n.h)) + 32
}
