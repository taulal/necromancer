/**
 * Ossuary tokens from docs/prototype/System.dc.html (NEC-02 → NEC-04).
 */
export const necroTokens = {
  ground: '#0E0D0C',
  surface: '#161513',
  well: '#121110',
  line: '#2A2724',
  lineStrong: '#4A4540',
  bone: '#E9E2D3',
  dust: '#A39C8E',
  faint: '#8A8378',
  alive: '#A6F36B',
  aliveSoft: '#C8FA9E',
  aliveWell: '#1E2A16',
  ember: '#FF8A4C',
  emberSoft: '#FFB48A',
  emberWell: '#22170F',
  fontSerif: "'Fraunces', Georgia, serif",
  fontSans: "'IBM Plex Sans', system-ui, sans-serif",
  fontMono: "'IBM Plex Mono', ui-monospace, monospace",
} as const

export type NecroToken = keyof typeof necroTokens
