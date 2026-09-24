import {Card, Heading, Stack, Text} from '@sanity/ui'

/**
 * Screen ids — BRIEF.md §8.
 * Graveyard (NEC-04) · Exhumation (NEC-08) · Autopsy (NEC-09) · Interrogation (NEC-11)
 * Ritual (NEC-13) · Rise (NEC-16)
 */
export const SCREENS = [
  'graveyard',
  'exhumation',
  'autopsy',
  'interrogation',
  'ritual',
  'rise',
] as const
export type Screen = (typeof SCREENS)[number]

/** @deprecated Use Graveyard / PlaceholderStage screens. Kept for any stray imports. */
export function Placeholder({screen}: {screen: Screen}) {
  return (
    <Card padding={5} tone="transparent">
      <Stack space={3}>
        <Heading size={3}>{screen}</Heading>
        <Text muted>Not yet raised.</Text>
      </Stack>
    </Card>
  )
}

export {Graveyard} from './Graveyard'
export {SeanceLayout} from './SeanceLayout'
export {PlaceholderStage} from './PlaceholderStage'
