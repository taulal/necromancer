import {Suspense} from 'react'
import {Link, NavLink, Outlet, useParams} from 'react-router'
import {useDocumentProjection} from '@sanity/sdk-react'
import {Box, Flex, Heading, Spinner, Stack, Text} from '@sanity/ui'

const STAGES = [
  {path: 'exhumation', label: 'Exhume'},
  {path: 'autopsy', label: 'Autopsy'},
  {path: 'interrogation', label: 'Interrogate'},
  {path: 'ritual', label: 'Ritual'},
  {path: 'rise', label: 'Rise'},
] as const

function SeanceHeader({seanceId}: {seanceId: string}) {
  const {data} = useDocumentProjection<{
    url?: string
    slug?: {current?: string}
    platform?: string
    status?: string
  }>({
    documentId: seanceId,
    documentType: 'seance',
    projection: `{url, slug, platform, status}`,
  })

  let host = data?.slug?.current || seanceId
  try {
    if (data?.url) host = new URL(data.url).hostname.replace(/^www\./, '')
  } catch {
    /* keep */
  }

  return (
    <Stack space={4}>
      <Flex align="baseline" justify="space-between" gap={4} wrap="wrap">
        <Stack space={2}>
          <Text size={1}>
            <Link to="/" style={{color: 'var(--necro-dust)', textDecoration: 'none'}}>
              ← Graveyard
            </Link>
          </Text>
          <Heading size={3} className="necro-serif" style={{fontWeight: 400}}>
            {host}
          </Heading>
          <Text size={1} className="necro-mono" muted>
            {data?.url || '—'} · {data?.platform || 'unknown'} · {data?.status || '—'}
          </Text>
        </Stack>
        {/* Workflow diagram lands with séance detail polish; slot reserved. */}
        <Text size={1} style={{color: 'var(--necro-faint)'}}>
          Diagram · later ticket
        </Text>
      </Flex>

      <Flex as="nav" gap={1} wrap="wrap" style={{borderBottom: '1px solid var(--necro-line)'}}>
        {STAGES.map((s) => (
          <NavLink
            key={s.path}
            to={s.path}
            style={({isActive}) => ({
              padding: '10px 14px',
              textDecoration: 'none',
              color: isActive ? 'var(--necro-alive)' : 'var(--necro-dust)',
              borderBottom: isActive ? '2px solid var(--necro-alive)' : '2px solid transparent',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            })}
          >
            {s.label}
          </NavLink>
        ))}
      </Flex>
    </Stack>
  )
}

/** Séance shell — BRIEF.md §8.2; stage screens render in the outlet. */
export function SeanceLayout() {
  const {seanceId} = useParams()
  if (!seanceId) return null

  return (
    <Box style={{minHeight: '100vh', background: 'var(--necro-ground)'}} padding={5}>
      <Suspense
        fallback={
          <Flex justify="center" padding={6}>
            <Spinner muted />
          </Flex>
        }
      >
        <SeanceHeader seanceId={seanceId} />
      </Suspense>
      <Box paddingTop={4}>
        <Outlet />
      </Box>
    </Box>
  )
}
