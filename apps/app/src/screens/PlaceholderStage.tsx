import {Card, Heading, Stack, Text} from '@sanity/ui'

const COPY: Record<string, string> = {
  exhumation: 'Sitemap tree and crawl progress land with NEC-08.',
  autopsy: 'The anatomy board lands with NEC-09.',
  interrogation: 'One question at a time lands with NEC-11.',
  ritual: 'Cast and step-through land with NEC-13.',
  rise: 'Before/after and the Rise button land with NEC-16.',
}

export function PlaceholderStage({stage}: {stage: keyof typeof COPY}) {
  return (
    <Card
      padding={4}
      radius={2}
      style={{background: 'var(--necro-surface)', border: '1px solid var(--necro-line)'}}
    >
      <Stack space={3}>
        <Heading
          size={2}
          className="necro-serif"
          style={{fontWeight: 400, textTransform: 'capitalize'}}
        >
          {stage}
        </Heading>
        <Text muted>{COPY[stage]}</Text>
        <Text size={1} style={{color: 'var(--necro-faint)'}}>
          Not yet raised.
        </Text>
      </Stack>
    </Card>
  )
}
