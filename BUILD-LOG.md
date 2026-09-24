# Build log

Honest, dated notes for the DEV write-up. What we tried, what broke, what we learned. Maintained by Claude; Cursor adds "Build-log notes" in each PR.

## Thu 24 Sep 2026

- Picked Necromancer from six ideas. Path Two: App SDK + Workflows as the spine.
- Base project `v9dl2xdi`, a sandbox where we'd already put Editorial Workflows through a PDF → RAG ingestion pipeline (AI effect → per-item child review → publish). Necromancer is that pattern scaled from "one PDF" to "one website".
- Decision: the Vessel front end uses an open block kit ("Bones") plus a schema-driven fallback renderer, so we show off the *schema* without shipping any agency IP.
- Decision: the crawl + AI worker lives in a Next.js route. A Sanity Function is only the trigger, because of Function time limits (and it's how the sandbox already worked).
- Scaffolded the monorepo. Found on day one:
  - The Workflows packages had moved from 0.28 (the sandbox) to **0.35** in five weeks. We pinned the fresh repo to 0.35 so it pairs with App SDK 3.x, and accepted re-verifying the sandbox gotchas.
  - The official `app-sanity-ui` template's loading `<Flex width="100vw">` fails typecheck against current Sanity UI. Fixed with `style`.
  - Next 16 deprecates `middleware.ts` in favour of `proxy.ts`.
