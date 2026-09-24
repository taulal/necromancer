import {useCallback, useState, type CSSProperties, type FormEvent} from 'react'
import {useNavigate} from 'react-router'
import {useClient} from '@sanity/sdk-react'
import {slugFromUrl} from '@necro/hq-schema'
import {Box, Button, Card, Flex, Heading, Stack, Text, useToast} from '@sanity/ui'
import {CloseIcon} from '@sanity/icons/Close'
import {SHOWCASE_DATASET} from '../lib/config'
import {normalizeSiteUrl} from '../lib/normalizeUrl'
import {seanceSubjectRef} from '../lib/seanceGdr'
import {useNecroEngine} from '../lib/useNecroEngine'
import {ShowcaseOccupancyProbe, type ShowcaseOccupancy} from './ShowcaseOccupancyProbe'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Summon drawer — docs/prototype/Main.dc.html + batch-4 NEC-UI1.
 * Creates a séance, starts resurrection with a GDR subject, fires begin-exhumation.
 * Uses the signed-in App SDK session only — no tokens.
 */
export function SummonDrawer({open, onClose}: Props) {
  const navigate = useNavigate()
  const toast = useToast()
  const client = useClient({apiVersion: '2025-03-01'})
  const engine = useNecroEngine()

  const [url, setUrl] = useState('')
  const [pageCap, setPageCap] = useState(50)
  const [visibilityPublic, setVisibilityPublic] = useState(false)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [occupancy, setOccupancy] = useState<ShowcaseOccupancy>({
    occupied: false,
    ownerSeanceId: null,
    occupantSlug: null,
    contentCount: 0,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onOccupancy = useCallback((value: ShowcaseOccupancy) => {
    setOccupancy(value)
  }, [])

  if (!open) return null

  const needsReplace = occupancy.occupied
  const canSubmit = !busy && (!needsReplace || replaceConfirmed)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const normalized = normalizeSiteUrl(url)
    if (!normalized) {
      setError('Enter a valid http(s) URL.')
      return
    }
    const slug = slugFromUrl(normalized)
    if (!slug) {
      setError('Could not derive a slug from that URL.')
      return
    }
    if (needsReplace && !replaceConfirmed) {
      setError('Confirm replacing the showcase occupant first.')
      return
    }

    setBusy(true)
    try {
      const existing = await client.fetch<{_id: string} | null>(
        `*[_type == "seance" && slug.current == $slug][0]{_id}`,
        {slug},
      )
      if (existing) {
        throw new Error(`A séance already exists for “${slug}”. Open it from the graveyard.`)
      }

      const seance = await client.create({
        _type: 'seance',
        url: normalized,
        slug: {_type: 'slug', current: slug},
        pageCap,
        targetMode: 'dataset',
        targetDataset: SHOWCASE_DATASET,
        visibility: visibilityPublic ? 'public' : 'private',
        replaceTarget: needsReplace && replaceConfirmed,
        status: 'alive',
      })

      const subject = seanceSubjectRef(seance._id)
      const started = await engine.startInstance({
        definition: 'resurrection',
        initialFields: [
          {
            type: 'subject',
            name: 'subject',
            value: subject,
          },
        ],
      })

      await engine.fireAction({
        instanceId: started.instance._id,
        activity: 'confirm',
        action: 'begin-exhumation',
      })

      toast.push({
        status: 'success',
        title: 'Exhumation begun',
        description: `${slug} is in the ground.`,
      })
      onClose()
      navigate(`/seance/${seance._id}/exhumation`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Summon failed'
      setError(message)
      toast.push({status: 'error', title: 'Summon failed', description: message})
    } finally {
      setBusy(false)
    }
  }

  const occupantLabel = occupancy.occupantSlug || 'another séance'

  return (
    <Box
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(14, 13, 12, 0.55)',
      }}
    >
      <ShowcaseOccupancyProbe onChange={onOccupancy} />
      <button
        type="button"
        aria-label="Dismiss summon drawer"
        onClick={onClose}
        style={{
          flex: 1,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          minWidth: 0,
        }}
      />
      <Card
        padding={5}
        radius={0}
        style={{
          width: 'min(480px, 100vw)',
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--necro-surface)',
          borderLeft: '1px solid var(--necro-line)',
          overflowY: 'auto',
        }}
      >
        <form
          onSubmit={onSubmit}
          role="dialog"
          aria-label="Summon a site"
          style={{display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%'}}
        >
          <Flex align="center" gap={3}>
            <Heading size={3} className="necro-serif" style={{fontWeight: 400, flex: 1, margin: 0}}>
              Summon
            </Heading>
            <Button
              type="button"
              mode="ghost"
              icon={CloseIcon}
              aria-label="Close"
              onClick={onClose}
              style={{minWidth: 44, minHeight: 44}}
            />
          </Flex>

          <Text size={1} style={{color: 'var(--necro-dust)', lineHeight: 1.5}}>
            Give it the address of a site that&apos;s dying. Nothing is published until you Rise.
          </Text>

          <Stack space={2}>
            <label htmlFor="summon-url" style={{fontSize: 13, fontWeight: 500}}>
              Site URL
            </label>
            <input
              id="summon-url"
              name="url"
              type="url"
              autoComplete="url"
              placeholder="https://harbourview-plumbing.co.nz"
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
              required
              className="necro-mono"
              style={inputStyle}
            />
          </Stack>

          <Flex gap={4}>
            <Stack space={2} style={{flex: 1}}>
              <label htmlFor="summon-cap" style={{fontSize: 13, fontWeight: 500}}>
                Page cap
              </label>
              <input
                id="summon-cap"
                name="pageCap"
                type="number"
                min={1}
                max={200}
                value={pageCap}
                onChange={(e) => setPageCap(Number(e.currentTarget.value) || 50)}
                className="necro-mono"
                style={{...inputStyle, height: 44}}
              />
            </Stack>
            <Stack space={2} style={{flex: 1}}>
              <label htmlFor="summon-target" style={{fontSize: 13, fontWeight: 500}}>
                Target dataset
              </label>
              <input
                id="summon-target"
                name="targetDataset"
                value={SHOWCASE_DATASET}
                readOnly
                className="necro-mono"
                style={{...inputStyle, height: 44, color: 'var(--necro-dust)'}}
              />
            </Stack>
          </Flex>

          <fieldset style={{border: 0, margin: 0, padding: 0}}>
            <legend style={{fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 8}}>
              Land it in
            </legend>
            <Stack space={2}>
              <label style={radioCardStyle(true)}>
                <input type="radio" name="targetMode" checked readOnly style={{marginTop: 3}} />
                <span>
                  <Text size={1} weight="medium" as="span" style={{display: 'block'}}>
                    Showcase dataset
                  </Text>
                  <Text size={0} style={{color: 'var(--necro-dust)'}}>
                    Shared public harbour in v9dl2xdi. One resurrected site at a time.
                  </Text>
                </span>
              </label>
              <label
                style={{
                  ...radioCardStyle(false),
                  opacity: 0.55,
                  cursor: 'not-allowed',
                }}
              >
                <input type="radio" name="targetMode" disabled style={{marginTop: 3}} />
                <span>
                  <Text size={1} weight="medium" as="span" style={{display: 'block'}}>
                    A new project
                  </Text>
                  <Text size={0} style={{color: 'var(--necro-dust)'}}>
                    Coming soon — one project per site, the way a real build ships.
                  </Text>
                </span>
              </label>
            </Stack>
          </fieldset>

          <label
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              fontSize: 14,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            <input
              type="checkbox"
              checked={visibilityPublic}
              onChange={(e) => setVisibilityPublic(e.currentTarget.checked)}
              style={{width: 18, height: 18, accentColor: 'var(--necro-alive)'}}
            />
            Make the resurrected dataset public
          </label>

          {needsReplace ? (
            <Card
              padding={3}
              radius={2}
              style={{
                background: 'var(--necro-ember-well)',
                border: '1px solid var(--necro-ember)',
              }}
            >
              <Stack space={3}>
                <Text size={1} style={{color: 'var(--necro-ember-soft)', lineHeight: 1.45}}>
                  Showcase holds {occupantLabel}… Replace it?
                </Text>
                <label
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    minHeight: 44,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={replaceConfirmed}
                    onChange={(e) => setReplaceConfirmed(e.currentTarget.checked)}
                    style={{width: 18, height: 18, accentColor: 'var(--necro-ember)'}}
                  />
                  <Text size={1}>Yes — wipe showcase on reanimate and raise this one instead</Text>
                </label>
              </Stack>
            </Card>
          ) : null}

          {error ? (
            <Text size={1} style={{color: 'var(--necro-ember)'}}>
              {error}
            </Text>
          ) : null}

          <Box style={{flexGrow: 1}} />

          <Button
            type="submit"
            text={busy ? 'Summoning…' : 'Begin exhumation'}
            disabled={!canSubmit}
            style={{
              height: 52,
              background: canSubmit ? 'var(--necro-alive)' : 'var(--necro-line)',
              color: 'var(--necro-ground)',
              fontWeight: 600,
              fontSize: 16,
            }}
          />
          <Text
            size={0}
            align="center"
            className="necro-mono"
            style={{color: 'var(--necro-faint)'}}
          >
            NecromancerBot honours robots.txt
          </Text>
        </form>
      </Card>
    </Box>
  )
}

const inputStyle: CSSProperties = {
  height: 48,
  boxSizing: 'border-box',
  padding: '0 14px',
  width: '100%',
  background: 'var(--necro-ground)',
  border: '1px solid var(--necro-line-strong)',
  borderRadius: 8,
  color: 'var(--necro-bone)',
  fontFamily: 'var(--necro-font-mono)',
  fontSize: 14,
}

function radioCardStyle(selected: boolean): CSSProperties {
  return {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    border: `1px solid ${selected ? 'var(--necro-alive)' : 'var(--necro-line)'}`,
    borderRadius: 8,
    background: selected ? 'var(--necro-alive-well)' : 'transparent',
    cursor: 'pointer',
    minHeight: 44,
  }
}
