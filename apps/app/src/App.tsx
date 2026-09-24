import {SanityApp} from '@sanity/sdk-react'
import {Flex, Spinner} from '@sanity/ui'
import {AppRouter} from './AppRouter'
import {sanityConfigs} from './lib/config'
import {useDrainKicker} from './lib/useDrainKicker'
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

function RoutedApp() {
  // Kick while any app screen is open; tighten to séance routes when Shell lands.
  useDrainKicker(true)
  return <AppRouter />
}

export default function App() {
  return (
    <NecroUI>
      <SanityApp config={sanityConfigs} fallback={<Loading />}>
        <RoutedApp />
      </SanityApp>
    </NecroUI>
  )
}
