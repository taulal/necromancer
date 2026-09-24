import {ThemeProvider, ToastProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import type {ReactNode} from 'react'
import {createGlobalStyle} from 'styled-components'

/**
 * Dark, occult, precise (BRIEF.md §8). Final tokens come from the Claude prototype (NEC-02).
 * TODO(NEC-04): map prototype tokens into buildTheme() palette overrides.
 */
const theme = buildTheme()

const GlobalStyle = createGlobalStyle`
  :root {
    --necro-bg: #0b0b0d;
    --necro-bone: #ece6da;
    --necro-alive: #9dff6b;
    --necro-ember: #ff7a3d;
  }
  html, body { margin: 0; padding: 0; background: var(--necro-bg); }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`

export function NecroUI({children}: {children: ReactNode}) {
  return (
    <>
      <GlobalStyle />
      <ThemeProvider theme={theme} scheme="dark">
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </>
  )
}
