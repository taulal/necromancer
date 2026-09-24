import {SanityApp} from '@sanity/sdk-react'
import {Flex, Spinner} from '@sanity/ui'
import {sanityConfigs} from './lib/config'
import {useDrainKicker} from './lib/useDrainKicker'
import {Placeholder} from './screens'
import {NecroUI} from './theme/NecroUI'

function Loading() {
  return (
    <Flex justify="center" align="center" height="fill" style={{width: '100vw'}}>
      <Spinner />
    </Flex>
  )
}

function Shell() {
  // TODO(NEC-04): enable only while a séance screen is open.
  useDrainKicker(true)
  return <Placeholder screen="graveyard" />
}

export default function App() {
  return (
    <NecroUI>
      <SanityApp config={sanityConfigs} fallback={<Loading />}>
        <Shell />
      </SanityApp>
    </NecroUI>
  )
}
