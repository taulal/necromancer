# Build log

Honest, dated notes for the DEV write-up. What we tried, what broke, what we learned. Maintained by Claude; Cursor adds "Build-log notes" in each PR.

## Thu 24 Sep 2026

- Picked Necromancer from six ideas. Path Two: App SDK + Workflows as the spine.
- Base project `v9dl2xdi`, a sandbox where we'd already put Editorial Workflows through a PDF → RAG ingestion pipeline (AI effect → per-item child review → publish). Necromancer is that pattern scaled from "one PDF" to "one website".
- Decision: the Vessel front end uses an open block kit ("Bones") plus a schema-driven fallback renderer, so we show off the _schema_ without shipping any agency IP.
- Decision: the crawl + AI worker lives in a Next.js route. A Sanity Function is only the trigger, because of Function time limits (and it's how the sandbox already worked).
- Scaffolded the monorepo. Found on day one:
  - The Workflows packages had moved from 0.28 (the sandbox) to **0.35** in five weeks. We pinned the fresh repo to 0.35 so it pairs with App SDK 3.x, and accepted re-verifying the sandbox gotchas.
  - The official `app-sanity-ui` template's loading `<Flex width="100vw">` fails typecheck against current Sanity UI. Fixed with `style`.
  - Next 16 deprecates `middleware.ts` in favour of `proxy.ts`.

### Batch 3 · dataset quota → shared showcase

- Project `v9dl2xdi` plan limit: **`maxDatasets: 2`** (`hq` + `showcase`). Creating `rip-*` → `402 Quota exceeded`. Raising the quota (or NEC-10p project-per-site) deferred.
- **Decision (skip NEC-10p for now):** every séance defaults to `targetMode: 'dataset'`, `targetDataset: 'showcase'`, `visibility: 'public'`. Project mode stays in the schema/code (`--mode project` on summon) but is **not** the default.
- **One site at a time:** `showcase` holds a single resurrection. `necro.reanimate` refuses if showcase already has another séance's content unless `replaceTarget` is set (`bun run summon <url> --replace`; App confirm later). Replace wipes showcase **documents + deployed schemas** first — never touches `hq`.
- Spike cleanup (24 Sep): deleted `_.schemas.spike` from showcase. Release `r3xHWiOV` still present — needs a working project write token to discard (HQ write token currently `401 Session not found`). Left `_.schemas.nec10s-spike` on `hq` alone (do not touch hq).
- Spikes NEC-10s / NEC-12s: both **GO** (schema-store PUT; Agent Actions on `versions.<releaseId>.<docId>`). Full write-ups live on PR #12 / nec-09 branch until that merges.
