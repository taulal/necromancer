import {SanityApp} from '@sanity/sdk-react'
import {Flex, Spinner} from '@sanity/ui'
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

export default function App() {
  return (
    <NecroUI>
      <SanityApp config={sanityConfigs} fallback={<Loading />}>
        <AppRouter />
      </SanityApp>
    </NecroUI>
  )
}
