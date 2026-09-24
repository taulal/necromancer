import type {Actor, HistoryEntry} from '@sanity/workflow-engine'
import {Box, Stack, Text} from '@sanity/ui'

/**
 * Format a history actor for the audit trail. Person / agent / system share
 * one visual treatment — no kind badges (BRIEF §8.2).
 */
export function actorLabel(actor: Actor | undefined): string {
  if (!actor?.id) return 'system'
  return actor.id
}

/** One-line summary of a history entry for the séance audit panel. */
export function historyEntrySummary(entry: HistoryEntry): string {
  const who = actorLabel('actor' in entry ? entry.actor : undefined)

  switch (entry._type) {
    case 'actionFired':
      return `${who} fired ${entry.action} · ${entry.activity}`
    case 'transitionFired':
      return `${who} transitioned ${entry.fromStage} → ${entry.toStage}`
    case 'stageEntered':
      return `${who} entered ${entry.stage}`
    case 'stageExited':
      return `${who} left ${entry.stage}`
    case 'activityStatusChanged':
      return `${who} · ${entry.activity}: ${entry.from} → ${entry.to}`
    case 'effectQueued':
      return `queued ${entry.effect}`
    case 'effectCompleted':
      return `${who} completed ${entry.effect} (${entry.status})`
    case 'effectClaimReleased':
      return `released ${entry.effect} (${entry.via})`
    case 'spawned':
      return `${who} spawned child · ${entry.activity}`
    case 'subworkflowAdopted':
      return `adopted child · ${entry.activity}`
    case 'subworkflowResolved':
      return `child resolved · ${entry.activity} (${entry.status})`
    case 'subworkflowOrphaned':
      return `orphan child · ${entry.detail}`
    default: {
      const fallback = entry as {_type: string}
      return fallback._type
    }
  }
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function AuditTrail({history}: {history: readonly HistoryEntry[]}) {
  const rows = [...history].reverse()

  return (
    <Box
      padding={3}
      style={{
        background: 'var(--necro-surface)',
        border: '1px solid var(--necro-line)',
        borderRadius: 2,
        maxHeight: 420,
        overflow: 'auto',
        minWidth: 260,
      }}
    >
      <Stack space={3}>
        <Text
          size={1}
          weight="medium"
          style={{letterSpacing: '0.06em', textTransform: 'uppercase'}}
        >
          Audit trail
        </Text>
        {rows.length === 0 ? (
          <Text size={1} muted>
            No history yet.
          </Text>
        ) : (
          <Stack space={3} as="ol" style={{listStyle: 'none', margin: 0, padding: 0}}>
            {rows.map((entry) => (
              <Box as="li" key={entry._key}>
                <Stack space={2}>
                  <Text size={1} style={{color: 'var(--necro-bone)'}}>
                    {historyEntrySummary(entry)}
                  </Text>
                  <Text size={0} className="necro-mono" muted>
                    {formatWhen(entry.at)}
                  </Text>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
