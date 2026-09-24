import {ThemeProvider, ToastProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import type {ReactNode} from 'react'
import {createGlobalStyle} from 'styled-components'
import {necroTokens as t} from './tokens'

/**
 * Dark, occult, precise (BRIEF.md §8 + docs/prototype/System.dc.html).
 */
const theme = buildTheme({
  // Sanity UI v3 accepts partial palette overrides via CSS vars we set below.
})

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

  :root {
    --necro-ground: ${t.ground};
    --necro-surface: ${t.surface};
    --necro-well: ${t.well};
    --necro-line: ${t.line};
    --necro-line-strong: ${t.lineStrong};
    --necro-bone: ${t.bone};
    --necro-dust: ${t.dust};
    --necro-faint: ${t.faint};
    --necro-alive: ${t.alive};
    --necro-alive-soft: ${t.aliveSoft};
    --necro-alive-well: ${t.aliveWell};
    --necro-ember: ${t.ember};
    --necro-ember-soft: ${t.emberSoft};
    --necro-ember-well: ${t.emberWell};
    --necro-font-serif: ${t.fontSerif};
    --necro-font-sans: ${t.fontSans};
    --necro-font-mono: ${t.fontMono};
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background: var(--necro-ground);
    color: var(--necro-bone);
    font-family: var(--necro-font-sans);
  }

  a { color: var(--necro-alive); }
  a:hover { color: var(--necro-alive-soft); }

  .necro-serif { font-family: var(--necro-font-serif); }
  .necro-mono { font-family: var(--necro-font-mono); }

  @keyframes necro-flicker {
    0%, 100% { opacity: 1; box-shadow: 0 0 10px var(--necro-alive); }
    45% { opacity: 0.82; box-shadow: 0 0 4px var(--necro-alive); }
    55% { opacity: 0.95; box-shadow: 0 0 14px var(--necro-alive); }
  }
  .necro-flicker {
    animation: necro-flicker 2.6s ease-in-out infinite;
  }

  @keyframes necro-soil {
    0% { background-position: 0 0; }
    100% { background-position: 40px 0; }
  }
  .necro-soil {
    background-image: repeating-linear-gradient(
      115deg,
      var(--necro-alive) 0 10px,
      #8fd95a 10px 20px
    );
    background-size: 40px 100%;
    animation: necro-soil 1.4s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }
  }

  button:focus-visible,
  a:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--necro-alive);
    outline-offset: 2px;
  }
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
