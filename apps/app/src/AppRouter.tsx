import {Suspense} from 'react'
import {MemoryRouter, Navigate, Route, Routes} from 'react-router'
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

/**
 * MemoryRouter: the App runs inside the Dashboard shell; the host URL/hash is not ours.
 * HashRouter was matching the catch-all ("This plot is empty") on preview/dev open.
 * In-app Links / navigate() still work; a full iframe remount resets to the Graveyard.
 */
export function AppRouter() {
  return (
    <MemoryRouter>
      <Suspense fallback={<Loading />}>
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
      </Suspense>
    </MemoryRouter>
  )
}
