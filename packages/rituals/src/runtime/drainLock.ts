/**
 * Single-flight drain lock on HQ (review F1).
 * Doc id `necro.drainLock`, taken with ifRevisionID. The lease covers a whole
 * background drain (Netlify caps those at 15 min); release happens in `finally`,
 * so a crashed run frees the lock after the lease at worst.
 */
import {getWorkflowClient} from './client'

export const DRAIN_LOCK_ID = 'necro.drainLock'
export const DRAIN_LOCK_LEASE_MS = 14 * 60 * 1000

export type DrainLockResult = {ok: true; rev: string} | {ok: false; reason: 'busy'}

export async function tryAcquireDrainLock(holder: string): Promise<DrainLockResult> {
  const client = getWorkflowClient()
  const now = Date.now()
  const until = new Date(now + DRAIN_LOCK_LEASE_MS).toISOString()

  const existing = await client.fetch<{
    _id: string
    _rev: string
    until?: string
    holder?: string
  } | null>(`*[_id == $id][0]{_id,_rev,until,holder}`, {id: DRAIN_LOCK_ID})

  if (existing?.until && Date.parse(existing.until) > now) {
    return {ok: false, reason: 'busy'}
  }

  try {
    if (!existing) {
      const created = await client.createOrReplace({
        _id: DRAIN_LOCK_ID,
        _type: 'necro.drainLock',
        holder,
        until,
        acquiredAt: new Date(now).toISOString(),
      })
      return {ok: true, rev: created._rev}
    }

    const patched = await client
      .patch(DRAIN_LOCK_ID)
      .set({holder, until, acquiredAt: new Date(now).toISOString()})
      .ifRevisionId(existing._rev)
      .commit()
    return {ok: true, rev: patched._rev}
  } catch {
    return {ok: false, reason: 'busy'}
  }
}

export async function releaseDrainLock(rev?: string): Promise<void> {
  const client = getWorkflowClient()
  try {
    const patch = client.patch(DRAIN_LOCK_ID).unset(['holder', 'until'])
    if (rev) patch.ifRevisionId(rev)
    await patch.commit()
  } catch {
    /* best-effort */
  }
}

/** Cheap read: is a drain currently holding an unexpired lock? (No write.) */
export async function isDrainLockHeld(): Promise<boolean> {
  const lock = await getWorkflowClient().fetch<{until?: string} | null>(`*[_id == $id][0]{until}`, {
    id: DRAIN_LOCK_ID,
  })
  return Boolean(lock?.until && Date.parse(lock.until) > Date.now())
}
