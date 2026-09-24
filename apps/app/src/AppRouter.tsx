import {Suspense} from 'react'
import {HashRouter, Navigate, Route, Routes} from 'react-router'
import {Box, Flex, Spinner, Text} from '@sanity/ui'
import {Graveyard} from './screens/Graveyard'
import {SeanceLayout} from './screens/SeanceLayout'
import {PlaceholderStage} from './screens/PlaceholderStage'

function Loading() {
  return (
    <Flex justify="center" align="center" height="fill" style={{minHeight: '100vh'}}>
      <Spinner muted />
    </Flex>
  )
}

function NotFound() {
  return (
    <Box padding={5}>
      <Text muted>This plot is empty.</Text>
    </Box>
  )
}

/**
 * Hash routes so the Dashboard iframe deep-links stay on the app origin.
 * Screens: Graveyard + 5 séance stages (Exhumation…Rise). Séance shell wraps stages.
 */
export function AppRouter() {
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Graveyard />} />
          <Route path="/seance/:seanceId" element={<SeanceLayout />}>
            <Route index element={<Navigate to="exhumation" replace />} />
            <Route path="exhumation" element={<PlaceholderStage stage="exhumation" />} />
            <Route path="autopsy" element={<PlaceholderStage stage="autopsy" />} />
            <Route path="interrogation" element={<PlaceholderStage stage="interrogation" />} />
            <Route path="ritual" element={<PlaceholderStage stage="ritual" />} />
            <Route path="rise" element={<PlaceholderStage stage="rise" />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
