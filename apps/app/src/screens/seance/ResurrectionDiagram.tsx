import {WorkflowDiagram, WS_CARD_TOKENS} from '@sanity/workflow-diagram'
import type {HistoryEntry, WorkflowDefinition} from '@sanity/workflow-engine'
import {Box} from '@sanity/ui'
import type {CSSProperties} from 'react'

/** Ossuary `--ws-*` overrides for {@link WorkflowDiagram}. */
export const OSSUARY_WS_TOKENS = {
  ...WS_CARD_TOKENS,
  '--ws-accent': 'var(--necro-alive)',
  '--ws-accent-bg': 'var(--necro-alive-well)',
  '--ws-panel': 'var(--necro-surface)',
  '--ws-ink': 'var(--necro-bone)',
  '--ws-ink-2': 'var(--necro-dust)',
  '--ws-border': 'var(--necro-line)',
  '--ws-path': 'var(--necro-alive)',
  '--ws-font': 'var(--necro-font-sans)',
  '--ws-font-weight': '500',
} as const satisfies Record<string, string>

export function ResurrectionDiagram({
  definition,
  currentStage,
  history,
  instanceId,
}: {
  definition: WorkflowDefinition
  currentStage?: string
  history?: readonly HistoryEntry[]
  instanceId: string
}) {
  return (
    <Box
      style={
        {
          ...OSSUARY_WS_TOKENS,
          background: 'var(--necro-well)',
          border: '1px solid var(--necro-line)',
          borderRadius: 2,
          overflow: 'hidden',
        } as CSSProperties
      }
    >
      <WorkflowDiagram
        key={instanceId}
        definition={definition}
        currentStage={currentStage}
        history={history}
        height={200}
        fill
        static
      />
    </Box>
  )
}
