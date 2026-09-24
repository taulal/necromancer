import type {ProposedTypeRow} from './types'

export type VersionDiff = {
  summary: string
  added: string[]
  removed: string[]
  fieldChanged: number
}

/** Diff current proposal types vs previous version (batch-4: "+1 type, 3 fields changed"). */
export function diffProposals(
  current: ProposedTypeRow[] | undefined,
  prior: ProposedTypeRow[] | undefined,
): VersionDiff | null {
  if (!current?.length) return null
  if (!prior?.length) {
    return {
      summary: `First anatomy · ${current.length} type${current.length === 1 ? '' : 's'}`,
      added: current.map((t) => t.name || '?').filter(Boolean),
      removed: [],
      fieldChanged: 0,
    }
  }

  const curByName = new Map(current.map((t) => [t.name || '', t]))
  const priorByName = new Map(prior.map((t) => [t.name || '', t]))
  const added: string[] = []
  const removed: string[] = []
  let fieldChanged = 0

  for (const name of curByName.keys()) {
    if (!name) continue
    if (!priorByName.has(name)) added.push(name)
  }
  for (const name of priorByName.keys()) {
    if (!name) continue
    if (!curByName.has(name)) removed.push(name)
  }

  for (const [name, cur] of curByName) {
    const old = priorByName.get(name)
    if (!old || !name) continue
    const curFields = new Map((cur.fields ?? []).map((f) => [f.name || '', f]))
    const oldFields = new Map((old.fields ?? []).map((f) => [f.name || '', f]))
    const names = new Set([...curFields.keys(), ...oldFields.keys()])
    for (const fn of names) {
      if (!fn) continue
      const a = curFields.get(fn)
      const b = oldFields.get(fn)
      if (!a || !b) {
        fieldChanged++
        continue
      }
      if (a.type !== b.type || a.required !== b.required) fieldChanged++
    }
  }

  const typeDelta = added.length - removed.length
  const typePart =
    typeDelta === 0
      ? `${current.length} types`
      : `${typeDelta > 0 ? '+' : ''}${typeDelta} type${Math.abs(typeDelta) === 1 ? '' : 's'}`
  const fieldPart =
    fieldChanged === 0
      ? 'no field changes'
      : `${fieldChanged} field${fieldChanged === 1 ? '' : 's'} changed`

  return {
    summary: `${typePart}, ${fieldPart}`,
    added,
    removed,
    fieldChanged,
  }
}
