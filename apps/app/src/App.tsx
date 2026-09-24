import {SanityApp} from '@sanity/sdk-react'
import {Flex, Spinner} from '@sanity/ui'
import {WorkflowTelemetryProvider} from '@sanity/workflow-sdk'
import {AppRouter} from './AppRouter'
import {sanityConfigs} from './lib/config'
import {NecroUI} from './theme/NecroUI'

function Loading() {
  return (
    <Flex
      justify="center"
      align="center"
      height="fill"
      style={{width: '100vw', minHeight: '100vh'}}
    >
      <Spinner />
    </Flex>
  )
}

// The drain kicker lives in SeanceLayout: it only polls while a séance screen is
// open and there is queued work.
export default function App() {
  return (
    <NecroUI>
      <SanityApp config={sanityConfigs} fallback={<Loading />}>
        <WorkflowTelemetryProvider>
          <AppRouter />
        </WorkflowTelemetryProvider>
      </SanityApp>
    </NecroUI>
  )
}
