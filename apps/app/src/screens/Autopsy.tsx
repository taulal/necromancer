import {Suspense, useMemo, useState, type CSSProperties} from 'react'
import {useParams} from 'react-router'
import {
  useDocumentProjection,
  useDocuments,
  useEditDocument,
  type DocumentHandle,
} from '@sanity/sdk-react'
import {useDocumentWorkflows, useWorkflowSession} from '@sanity/workflow-sdk'
import {BONES} from '@necro/bones'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Select,
  Spinner,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui'
import {useNecroEngine} from '../lib/useNecroEngine'
import {seanceGdrUri} from '../lib/seanceGdr'
import {canvasHeight, layoutTypes} from './autopsy/layout'
import {findMergeHints} from './autopsy/mergeHint'
import type {ProposalProjection, ProposedTypeRow} from './autopsy/types'
import {classifyNode, isVisibleType} from './autopsy/types'
import {diffProposals} from './autopsy/versionDiff'

const PROPOSAL_PROJECTION = `{
  _id, version, acceptedAt, model, inputTokens, outputTokens, repairRounds,
  types[]{
    _key, name, title, kind, bonesMatch, rationale, confidence, decision, mergeInto,
    fields[]{_key, name, type, of, to, required, evidenceCount, description},
    evidence[]{_key, excerpt, "pageUrl": page->url, "pagePath": page->path, "pageId": page._ref}
  }
}`

const panelStyle: CSSProperties = {
  background: 'var(--necro-surface)',
  border: '1px solid var(--necro-line)',
}

/** Autopsy board — NEC-UI2 / docs/prototype/Autopsy.dc.html + batch-4. */
export function Autopsy() {
  const {seanceId} = useParams()
  if (!seanceId) return null

  return (
    <Suspense
      fallback={
        <Flex justify="center" padding={6}>
          <Spinner muted />
        </Flex>
      }
    >
      <AutopsyBody seanceId={seanceId} />
    </Suspense>
  )
}

function AutopsyBody({seanceId}: {seanceId: string}) {
  const {data: handles} = useDocuments({
    documentType: 'schemaProposal',
    filter: 'seance._ref == $seanceId',
    params: {seanceId},
    batchSize: 20,
    orderings: [{field: 'version', direction: 'desc'}],
  })

  if (!handles?.length) {
    return (
      <Card padding={5} radius={2} style={panelStyle}>
        <Stack space={3}>
          <Heading size={2} className="necro-serif" style={{fontWeight: 400}}>
            Autopsy board
          </Heading>
          <Text muted>No anatomy yet. The autopsy is still in the ground — or it failed.</Text>
          <Text size={1} style={{color: 'var(--necro-faint)'}}>
            Nothing needs you. The dead are patient.
          </Text>
        </Stack>
      </Card>
    )
  }

  const latest = handles[0]!
  const prior = handles[1]

  return (
    <Stack space={4}>
      <Flex align="baseline" justify="space-between" gap={4} wrap="wrap">
        <Stack space={2}>
          <Heading size={2} className="necro-serif" style={{fontWeight: 400}}>
            Autopsy board
          </Heading>
          <Suspense
            fallback={
              <Text muted size={1}>
                Anatomy…
              </Text>
            }
          >
            <VersionChrome latest={latest} prior={prior} />
          </Suspense>
        </Stack>
        <Suspense fallback={<Button text="Accept anatomy" disabled />}>
          <AutopsyActions seanceId={seanceId} proposalId={latest.documentId} />
        </Suspense>
      </Flex>

      <Suspense
        fallback={
          <Flex justify="center" padding={6}>
            <Spinner muted />
          </Flex>
        }
      >
        <ProposalBoard handle={latest} />
      </Suspense>
    </Stack>
  )
}

function VersionChrome({latest, prior}: {latest: DocumentHandle; prior?: DocumentHandle}) {
  const {data: current} = useDocumentProjection<ProposalProjection>({
    ...latest,
    projection: `{version, types[]{_key, name, fields[]{_key, name, type, required}}}`,
  })

  if (!prior) {
    return (
      <Text size={1} className="necro-mono" muted>
        Anatomy v{current?.version ?? '?'} · first cut
      </Text>
    )
  }

  return (
    <Suspense
      fallback={
        <Text size={1} className="necro-mono" muted>
          Anatomy v{current?.version ?? '?'}
        </Text>
      }
    >
      <PriorDiffLine prior={prior} current={current} />
    </Suspense>
  )
}

function PriorDiffLine({
  prior,
  current,
}: {
  prior: DocumentHandle
  current: ProposalProjection | null | undefined
}) {
  const {data: prev} = useDocumentProjection<ProposalProjection>({
    ...prior,
    projection: `{version, types[]{_key, name, fields[]{_key, name, type, required}}}`,
  })
  const diff = diffProposals(current?.types, prev?.types)
  return (
    <Text size={1} className="necro-mono" muted>
      Anatomy v{current?.version ?? '?'}
      {diff ? ` · vs v${prev?.version ?? '?'} · ${diff.summary}` : null}
    </Text>
  )
}

function ProposalBoard({handle}: {handle: DocumentHandle}) {
  const {data} = useDocumentProjection<ProposalProjection>({
    ...handle,
    projection: PROPOSAL_PROJECTION,
  })
  const types = data?.types ?? []
  const frozen = Boolean(data?.acceptedAt)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const selected =
    types.find((t) => (t._key || t.name) === selectedKey) ??
    types.find(isVisibleType) ??
    types[0] ??
    null

  const hints = useMemo(() => findMergeHints(types), [types])
  const {nodes, edges} = useMemo(() => layoutTypes(types), [types])
  const height = canvasHeight(nodes)

  const editTypes = useEditDocument<ProposedTypeRow[]>({
    documentId: handle.documentId,
    documentType: 'schemaProposal',
    path: 'types',
  })

  const patchType = (key: string, patch: (t: ProposedTypeRow) => ProposedTypeRow) => {
    if (frozen) return
    void editTypes((current) => {
      const list = Array.isArray(current) ? current : types
      return list.map((t) => ((t._key || t.name) === key ? patch(t) : t))
    })
  }

  return (
    <Stack space={3}>
      {hints[0] && !frozen ? (
        <Card
          padding={3}
          radius={2}
          style={{
            background: 'var(--necro-ember-well)',
            border: '1px solid var(--necro-ember)',
          }}
        >
          <Flex align="center" justify="space-between" gap={3} wrap="wrap">
            <Text size={1}>
              These look like the same bones — <strong>{hints[0].a}</strong> and{' '}
              <strong>{hints[0].b}</strong> share {Math.round(hints[0].overlap * 100)}% of their
              fields.
            </Text>
            <Button
              text={`Merge ${hints[0].b} into…`}
              mode="ghost"
              fontSize={1}
              onClick={() => {
                const source = types.find((t) => t.name === hints[0]!.b)
                const target = hints[0]!.a
                if (!source) return
                patchType(source._key || source.name || '', (t) => ({
                  ...t,
                  decision: 'merge',
                  mergeInto: target,
                }))
                setSelectedKey(source._key || source.name || null)
              }}
            />
          </Flex>
        </Card>
      ) : null}

      <Grid columns={[1, 1, 12]} gap={4}>
        <Card
          padding={3}
          radius={2}
          style={{...panelStyle, gridColumn: 'span 7', minHeight: height, position: 'relative'}}
        >
          <NodeCanvas
            nodes={nodes}
            edges={edges}
            types={types}
            selectedKey={selected?._key || selected?.name || null}
            height={height}
            onSelect={setSelectedKey}
          />
        </Card>

        <Box style={{gridColumn: 'span 5'}}>
          {selected ? (
            <Inspector
              type={selected}
              allTypes={types}
              frozen={frozen}
              pageCount={Math.max(
                1,
                ...types.map((t) => t.evidence?.length ?? 0),
                ...(selected.fields ?? []).map((f) => f.evidenceCount ?? 0),
              )}
              onPatch={(patch) => patchType(selected._key || selected.name || '', patch)}
            />
          ) : (
            <Card padding={4} radius={2} style={panelStyle}>
              <Text muted>Select a type.</Text>
            </Card>
          )}
        </Box>
      </Grid>

      {data?.model ? (
        <Text size={1} className="necro-mono" style={{color: 'var(--necro-faint)'}}>
          {data.model} · {data.inputTokens ?? 0} in / {data.outputTokens ?? 0} out · repair{' '}
          {data.repairRounds ?? 0}
          {frozen ? ' · accepted' : ''}
        </Text>
      ) : null}
    </Stack>
  )
}

function NodeCanvas({
  nodes,
  edges,
  types,
  selectedKey,
  height,
  onSelect,
}: {
  nodes: ReturnType<typeof layoutTypes>['nodes']
  edges: ReturnType<typeof layoutTypes>['edges']
  types: ProposedTypeRow[]
  selectedKey: string | null
  height: number
  onSelect: (key: string) => void
}) {
  const byName = new Map(nodes.map((n) => [n.name, n]))

  return (
    <Box style={{position: 'relative', width: '100%', height, overflow: 'auto'}}>
      <svg
        width="100%"
        height={height}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
        aria-hidden
      >
        {edges.map((e, i) => {
          const a = byName.get(e.from)
          const b = byName.get(e.to)
          if (!a || !b) return null
          const x1 = a.x + a.w / 2
          const y1 = a.y + a.h
          const x2 = b.x + b.w / 2
          const y2 = b.y
          const stroke =
            e.style === 'ref'
              ? 'var(--necro-alive)'
              : e.style === 'chrome'
                ? 'var(--necro-bone)'
                : 'var(--necro-line-strong)'
          const dash = e.style === 'body' ? undefined : e.style === 'chrome' ? '2 4' : '4 4'
          return (
            <path
              key={`${e.from}-${e.to}-${i}`}
              d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={1.5}
              strokeDasharray={dash}
            />
          )
        })}
      </svg>

      {nodes.map((n) => {
        const t = types.find((x) => (x._key || x.name) === n.key || x.name === n.name)
        const selected = (t?._key || t?.name) === selectedKey
        const selectable = n.kind !== 'bones'
        return (
          <button
            key={n.key}
            type="button"
            disabled={!selectable}
            onClick={() => selectable && onSelect(t?._key || t?.name || n.key)}
            aria-pressed={selected}
            style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              width: n.w,
              height: n.h,
              padding: n.kind === 'bones' ? '8px 12px' : '12px 14px',
              textAlign: 'left',
              cursor: selectable ? 'pointer' : 'default',
              borderRadius: 8,
              border: nodeBorder(n.kind, selected, t),
              background: selected
                ? 'var(--necro-alive-well)'
                : n.kind === 'bones'
                  ? '#141312'
                  : '#171614',
              color: 'var(--necro-bone)',
              fontFamily: 'var(--necro-font-mono)',
              fontSize: n.kind === 'bones' ? 12 : 14,
            }}
          >
            <Flex align="center" justify="space-between" gap={2}>
              <span style={{fontWeight: 500}}>{n.name}</span>
              <Badge fontSize={0} tone={n.kind === 'singleton' ? 'default' : 'neutral'}>
                {nodeBadge(t, n.kind)}
              </Badge>
            </Flex>
            <Text size={0} style={{color: 'var(--necro-faint)', marginTop: 4}}>
              {nodeSub(t, n.kind)}
            </Text>
          </button>
        )
      })}

      {!nodes.length ? (
        <Flex align="center" justify="center" style={{height: '100%'}}>
          <Text muted>No types kept in this anatomy.</Text>
        </Flex>
      ) : null}
    </Box>
  )
}

function nodeBorder(
  kind: ReturnType<typeof classifyNode>,
  selected: boolean,
  t: ProposedTypeRow | undefined,
): string {
  if (selected) return '2px solid var(--necro-alive)'
  if (kind === 'singleton') return '1px dashed var(--necro-bone)'
  if (t && (t.evidence?.length ?? 0) === 0 && kind === 'document') return '1px solid #6FA84A'
  return '1px solid var(--necro-line-strong)'
}

function nodeBadge(t: ProposedTypeRow | undefined, kind: ReturnType<typeof classifyNode>): string {
  if (kind === 'bones') return 'bone'
  if (kind === 'singleton') return '1'
  const n = t?.evidence?.length
  if (n != null && n > 0) return `×${n}`
  return t?.kind === 'document' ? 'doc' : kind
}

function nodeSub(t: ProposedTypeRow | undefined, kind: ReturnType<typeof classifyNode>): string {
  if (kind === 'bones') return t?.bonesMatch || 'Bones'
  if (t?.bonesMatch) return `Bones · ${t.bonesMatch}`
  if (t?.kind === 'singleton') return 'one per site'
  const fields = t?.fields?.length ?? 0
  return `${fields} field${fields === 1 ? '' : 's'}`
}

function Inspector({
  type,
  allTypes,
  frozen,
  pageCount,
  onPatch,
}: {
  type: ProposedTypeRow
  allTypes: ProposedTypeRow[]
  frozen: boolean
  pageCount: number
  onPatch: (patch: (t: ProposedTypeRow) => ProposedTypeRow) => void
}) {
  const mergeTargets = allTypes
    .filter(isVisibleType)
    .filter((t) => t.name && t.name !== type.name)
    .map((t) => t.name!)

  const kindLabel =
    type.kind === 'singleton'
      ? 'singleton'
      : type.kind === 'object'
        ? type.bonesMatch
          ? 'Bones block'
          : 'object'
        : 'document'

  return (
    <Card padding={4} radius={2} style={panelStyle}>
      <Stack space={4}>
        <Stack space={2}>
          <Text size={1} className="necro-mono" muted>
            {kindLabel}
            {typeof type.confidence === 'number'
              ? ` · ${Math.round(type.confidence * 100)}% sure`
              : ''}
          </Text>
          <label>
            <Text size={1} muted>
              Name
            </Text>
            <TextInput
              value={type.name ?? ''}
              disabled={frozen}
              onChange={(e) => {
                const name = e.currentTarget.value
                onPatch((t) => ({...t, name, title: t.title || name}))
              }}
              fontSize={2}
              style={{fontFamily: 'var(--necro-font-mono)'}}
            />
          </label>
          <label>
            <Text size={1} muted>
              Title
            </Text>
            <TextInput
              value={type.title ?? ''}
              disabled={frozen}
              onChange={(e) => onPatch((t) => ({...t, title: e.currentTarget.value}))}
            />
          </label>
        </Stack>

        {type.rationale ? (
          <Text size={1} style={{lineHeight: 1.5}}>
            {type.rationale}
          </Text>
        ) : null}

        <Stack space={2}>
          <Text size={1} weight="semibold">
            Fields
          </Text>
          <Box style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
              <thead>
                <tr style={{color: 'var(--necro-faint)', textAlign: 'left'}}>
                  <th style={{padding: '6px 4px'}}>name</th>
                  <th style={{padding: '6px 4px'}}>type</th>
                  <th style={{padding: '6px 4px'}}>required</th>
                  <th style={{padding: '6px 4px'}}>seen</th>
                </tr>
              </thead>
              <tbody>
                {(type.fields ?? []).map((f) => (
                  <tr key={f._key || f.name} style={{borderTop: '1px solid var(--necro-line)'}}>
                    <td style={{padding: '8px 4px', fontFamily: 'var(--necro-font-mono)'}}>
                      {f.name}
                    </td>
                    <td style={{padding: '8px 4px', color: 'var(--necro-dust)'}}>
                      {formatFieldType(f)}
                    </td>
                    <td style={{padding: '8px 4px'}}>
                      <button
                        type="button"
                        disabled={frozen}
                        onClick={() =>
                          onPatch((t) => ({
                            ...t,
                            fields: (t.fields ?? []).map((row) =>
                              (row._key || row.name) === (f._key || f.name)
                                ? {...row, required: !row.required}
                                : row,
                            ),
                          }))
                        }
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--necro-line-strong)',
                          borderRadius: 4,
                          color: f.required ? 'var(--necro-alive)' : 'var(--necro-faint)',
                          padding: '4px 8px',
                          cursor: frozen ? 'default' : 'pointer',
                          minHeight: 32,
                        }}
                      >
                        {f.required ? 'yes' : 'no'}
                      </button>
                    </td>
                    <td style={{padding: '8px 4px', color: 'var(--necro-dust)'}}>
                      {f.evidenceCount != null ? `${f.evidenceCount}/${pageCount}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Stack>

        <Stack space={2}>
          <Text size={1} weight="semibold">
            Evidence
          </Text>
          {(type.evidence ?? []).length === 0 ? (
            <Text size={1} muted>
              No excerpts on this type.
            </Text>
          ) : (
            (type.evidence ?? []).map((ev) => (
              <Card
                key={ev._key || ev.excerpt}
                padding={3}
                radius={2}
                style={{background: 'var(--necro-well)', border: '1px solid var(--necro-line)'}}
              >
                <Stack space={2}>
                  {ev.pageUrl ? (
                    <Text size={0} className="necro-mono">
                      <a
                        href={ev.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{color: 'var(--necro-alive)'}}
                      >
                        {ev.pagePath || ev.pageUrl}
                      </a>
                    </Text>
                  ) : (
                    <Text size={0} muted>
                      {ev.pagePath || ev.pageId || 'page'}
                    </Text>
                  )}
                  <Text size={1} style={{fontStyle: 'italic', color: 'var(--necro-dust)'}}>
                    “{ev.excerpt}”
                  </Text>
                </Stack>
              </Card>
            ))
          )}
        </Stack>

        <Stack space={3}>
          <label>
            <Text size={1} muted>
              Bones mapping
            </Text>
            <Select
              value={type.bonesMatch ?? ''}
              disabled={frozen}
              onChange={(e) => {
                const v = e.currentTarget.value
                onPatch((t) => ({...t, bonesMatch: v || null}))
              }}
            >
              <option value="">Custom (no Bones match)</option>
              {BONES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </label>

          <label>
            <Text size={1} muted>
              Merge into…
            </Text>
            <Select
              value={type.decision === 'merge' ? (type.mergeInto ?? '') : ''}
              disabled={frozen || mergeTargets.length === 0}
              onChange={(e) => {
                const v = e.currentTarget.value
                if (!v) {
                  onPatch((t) => ({...t, decision: 'keep', mergeInto: null}))
                  return
                }
                onPatch((t) => ({...t, decision: 'merge', mergeInto: v}))
              }}
            >
              <option value="">Keep as its own type</option>
              {mergeTargets.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>

          <Flex gap={2} wrap="wrap">
            <Button
              text="Drop"
              mode="ghost"
              tone="critical"
              disabled={frozen}
              onClick={() => onPatch((t) => ({...t, decision: 'drop', mergeInto: null}))}
            />
            {type.decision && type.decision !== 'keep' ? (
              <Button
                text="Keep"
                mode="ghost"
                disabled={frozen}
                onClick={() => onPatch((t) => ({...t, decision: 'keep', mergeInto: null}))}
              />
            ) : null}
          </Flex>

          {type.decision === 'drop' ? (
            <Text size={1} style={{color: 'var(--necro-ember)'}}>
              Marked drop — hidden from the canvas until you Keep.
            </Text>
          ) : null}
          {type.decision === 'merge' && type.mergeInto ? (
            <Text size={1} style={{color: 'var(--necro-ember)'}}>
              Will merge into <strong>{type.mergeInto}</strong> on Accept.
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </Card>
  )
}

function formatFieldType(f: {type?: string; of?: string[]; to?: string[]}): string {
  if (f.type === 'array' && f.of?.length) return `array<${f.of.join('|')}>`
  if (f.type === 'reference' && f.to?.length) return `ref→${f.to.join('|')}`
  return f.type || '?'
}

function AutopsyActions({seanceId, proposalId}: {seanceId: string; proposalId: string}) {
  const engine = useNecroEngine()
  const list = useDocumentWorkflows({engine, document: seanceGdrUri(seanceId)})
  const instanceId = list.instances?.[0]?._id
  const editAcceptedAt = useEditDocument<string>({
    documentId: proposalId,
    documentType: 'schemaProposal',
    path: 'acceptedAt',
  })

  if (!instanceId) {
    return (
      <Flex gap={2}>
        <Button text="Re-run autopsy" disabled />
        <Button text="Accept anatomy" tone="positive" disabled />
      </Flex>
    )
  }

  return (
    <AutopsyActionsSession
      instanceId={instanceId}
      onAccept={async () => {
        await editAcceptedAt(new Date().toISOString())
      }}
    />
  )
}

function AutopsyActionsSession({
  instanceId,
  onAccept,
}: {
  instanceId: string
  onAccept: () => Promise<void>
}) {
  const engine = useNecroEngine()
  const session = useWorkflowSession({engine, instanceId})
  const busy = isAutopsyBusy(session)
  const [pending, setPending] = useState<'rerun' | 'accept' | null>(null)

  const fire = async (action: 'rerun-autopsy' | 'accept-anatomy') => {
    setPending(action === 'rerun-autopsy' ? 'rerun' : 'accept')
    try {
      if (action === 'accept-anatomy') await onAccept()
      await engine.fireAction({
        instanceId,
        activity: 'accept',
        action,
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <Flex gap={2} wrap="wrap">
      <Button
        text="Re-run autopsy"
        mode="ghost"
        disabled={busy || pending != null}
        loading={pending === 'rerun'}
        onClick={() => void fire('rerun-autopsy')}
      />
      <Button
        text="Accept anatomy"
        tone="positive"
        disabled={busy || pending != null}
        loading={pending === 'accept'}
        className={busy ? undefined : 'necro-flicker'}
        onClick={() => void fire('accept-anatomy')}
      />
    </Flex>
  )
}

function isAutopsyBusy(session: ReturnType<typeof useWorkflowSession>): boolean {
  const fields = session.evaluation?.instance.fields
  const rerunBusy = fields?.find((f) => f.name === 'autopsyRerunBusy')
  if (rerunBusy?.value === true) return true

  const effects = session.evaluation?.instance.effects as
    Array<{name?: string; status?: string}> | undefined
  if (!effects) return false
  return effects.some(
    (e) =>
      (e.name === 'necro.autopsy' || e.name === 'necro.autopsy-rerun') &&
      (e.status === 'pending' || e.status === 'running' || e.status === 'claimed'),
  )
}
