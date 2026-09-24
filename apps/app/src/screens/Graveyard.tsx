import {Suspense, useState} from 'react'
import {Link} from 'react-router'
import {useDocuments, useDocumentProjection, type DocumentHandle} from '@sanity/sdk-react'
import {Badge, Box, Button, Card, Flex, Grid, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {SummonDrawer} from './SummonDrawer'

type SeanceCard = {
  url?: string
  slug?: {current?: string}
  platform?: string
  status?: string
  stats?: {pages?: number}
}

function Tombstone(handle: DocumentHandle) {
  const {data} = useDocumentProjection<SeanceCard>({
    ...handle,
    projection: `{url, slug, platform, status, stats}`,
  })

  let host = data?.slug?.current || 'séance'
  try {
    if (data?.url) host = new URL(data.url).hostname.replace(/^www\./, '')
  } catch {
    /* keep slug */
  }

  const haunted = data?.status === 'haunted'
  const to = `/seance/${handle.documentId}`

  return (
    <Link to={to} style={{textDecoration: 'none', color: 'inherit', display: 'block'}}>
      <Card
        padding={4}
        radius={2}
        style={{
          background: 'var(--necro-surface)',
          border: '1px solid var(--necro-line)',
          minHeight: 140,
        }}
      >
        <Stack space={3}>
          <Flex align="center" justify="space-between" gap={3}>
            <Heading size={1} className="necro-serif" style={{fontWeight: 400}}>
              {host}
            </Heading>
            {haunted ? (
              <Badge tone="caution" fontSize={1}>
                haunted
              </Badge>
            ) : null}
          </Flex>
          <Text size={1} muted className="necro-mono">
            {data?.platform || 'unknown'}
            {data?.stats?.pages != null ? ` · ${data.stats.pages} pages` : ''}
          </Text>
          <Text size={1} style={{color: 'var(--necro-dust)'}}>
            {data?.status || 'summoned'}
          </Text>
        </Stack>
      </Card>
    </Link>
  )
}

function TombstoneFallback() {
  return (
    <Card
      padding={4}
      radius={2}
      style={{
        background: 'var(--necro-surface)',
        border: '1px solid var(--necro-line)',
        minHeight: 140,
      }}
    >
      <Text muted size={1}>
        Raising…
      </Text>
    </Card>
  )
}

function SeanceGrid() {
  const {data, hasMore, loadMore, isPending} = useDocuments({
    documentType: 'seance',
    batchSize: 24,
    orderings: [{field: '_updatedAt', direction: 'desc'}],
  })

  if (!data.length) {
    return (
      <Stack space={4} padding={5}>
        <Heading size={3} className="necro-serif" style={{fontWeight: 400}}>
          The graveyard is empty
        </Heading>
        <Text muted>Summon a dead site to begin a séance.</Text>
      </Stack>
    )
  }

  return (
    <Stack space={4}>
      <Grid columns={[1, 2, 3]} gap={3}>
        {data.map((handle) => (
          <Suspense key={handle.documentId} fallback={<TombstoneFallback />}>
            <Tombstone {...handle} />
          </Suspense>
        ))}
      </Grid>
      {hasMore ? (
        <Button
          mode="ghost"
          text={isPending ? 'Loading…' : 'Load more plots'}
          onClick={() => loadMore()}
          disabled={isPending}
        />
      ) : null}
    </Stack>
  )
}

/** Home — BRIEF.md §8.1 / docs/prototype/Main.dc.html */
export function Graveyard() {
  const [summonOpen, setSummonOpen] = useState(false)

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'var(--necro-ground)',
        color: 'var(--necro-bone)',
      }}
    >
      <Flex
        as="header"
        align="center"
        justify="space-between"
        paddingX={5}
        style={{
          height: 72,
          borderBottom: '1px solid var(--necro-line)',
          boxSizing: 'border-box',
        }}
      >
        <Flex align="center" gap={3}>
          <span
            className="necro-flicker"
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: 'var(--necro-alive)',
              display: 'inline-block',
            }}
            aria-hidden
          />
          <Heading size={2} className="necro-serif" style={{fontWeight: 400, margin: 0}}>
            Necromancer
          </Heading>
          <Text size={1} style={{color: 'var(--necro-faint)', letterSpacing: '0.08em'}}>
            GRAVEYARD
          </Text>
        </Flex>
        <Button
          text="Summon"
          tone="primary"
          mode="default"
          onClick={() => setSummonOpen(true)}
          style={{
            background: 'var(--necro-alive)',
            color: 'var(--necro-ground)',
            minHeight: 44,
            minWidth: 44,
          }}
        />
      </Flex>

      <Box padding={5}>
        <Suspense
          fallback={
            <Flex justify="center" padding={6}>
              <Spinner muted />
            </Flex>
          }
        >
          <SeanceGrid />
        </Suspense>
      </Box>

      <SummonDrawer open={summonOpen} onClose={() => setSummonOpen(false)} />
    </Box>
  )
}
