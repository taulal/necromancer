import {SanityApp} from '@sanity/sdk-react'
import {Flex, Spinner} from '@sanity/ui'
import {sanityConfigs} from './lib/config'
import {Placeholder} from './screens'
import {NecroUI} from './theme/NecroUI'

function Loading() {
  return (
    <Flex justify="center" align="center" height="fill" style={{width: '100vw'}}>
      <Spinner />
    </Flex>
  )
}

export default function App() {
  return (
    <NecroUI>
      <SanityApp config={sanityConfigs} fallback={<Loading />}>
        {/* TODO(NEC-04): router + Graveyard as home */}
        <Placeholder screen="graveyard" />
      </SanityApp>
    </NecroUI>
  )
}
