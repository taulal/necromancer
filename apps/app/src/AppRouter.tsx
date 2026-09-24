import {Suspense, useEffect, type ReactNode} from 'react'
import {HashRouter, Navigate, Route, Routes, useLocation} from 'react-router'
import {Flex, Spinner} from '@sanity/ui'
import {Graveyard} from './screens/Graveyard'
import {SeanceLayout} from './screens/SeanceLayout'
import {Exhumation} from './screens/Exhumation'
import {Autopsy} from './screens/Autopsy'
import {PlaceholderStage} from './screens/PlaceholderStage'

function Loading() {
  return (
    <Flex justify="center" align="center" height="fill" style={{minHeight: '100vh'}}>
      <Spinner muted />
    </Flex>
  )
}

const SEANCE_PATH = /^\/seance\/[^/]+(?:\/(?:exhumation|autopsy|interrogation|ritual|rise)?)?\/?$/

/** Keep only Graveyard / séance stage hashes; wipe Dashboard host junk. */
export function isAppRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  return path === '/' || SEANCE_PATH.test(path)
}

function stripNonRouteHash(): void {
  if (typeof window === 'undefined') return
  const raw = window.location.hash.replace(/^#/, '')
  const path = raw.split('?')[0] || '/'
  if (!raw || isAppRoutePath(path.startsWith('/') ? path : `/${path}`)) return
  const next = `${window.location.pathname}${window.location.search}#/`
  window.history.replaceState(null, '', next)
}

function HashGuard({children}: {children: ReactNode}) {
  const location = useLocation()
  useEffect(() => {
    if (!isAppRoutePath(location.pathname)) {
      // Navigate handles unknown routes; also scrub the raw hash if needed.
      stripNonRouteHash()
    }
  }, [location.pathname])
  return <>{children}</>
}

/**
 * HashRouter so in-app deep links stay on the Dashboard iframe origin.
 * Catch-all sends unknown paths home; stripNonRouteHash clears host junk hashes.
 */
export function AppRouter() {
  stripNonRouteHash()
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <HashGuard>
          <Routes>
            <Route path="/" element={<Graveyard />} />
            <Route path="/seance/:seanceId" element={<SeanceLayout />}>
              <Route index element={<Navigate to="exhumation" replace />} />
              <Route path="exhumation" element={<Exhumation />} />
              <Route path="autopsy" element={<Autopsy />} />
              <Route path="interrogation" element={<PlaceholderStage stage="interrogation" />} />
              <Route path="ritual" element={<PlaceholderStage stage="ritual" />} />
              <Route path="rise" element={<PlaceholderStage stage="rise" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashGuard>
      </Suspense>
    </HashRouter>
  )
}
