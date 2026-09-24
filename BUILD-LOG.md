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

### Batch 3 kickoff

- Landed Claude's missing B1–B5/B7 via `push-batch2b.sh` → `origin/main` includes question-gate B7 (must re-deploy blueprints in NEC-07c).
- `docs/batch-3.md` + `bun run summon` CLI (#11). Bones catalogue (#10). Autopsy engine (#12). Showcase target (#13).
- **NEC-07c:** waiting on Netlify site URL + env. Cursor checklist once `VESSEL_URL` exists: `/.netlify/functions/drain-background` → 401 without secret; workspace packages resolve; unattended exhume claim within 60s with App closed; then `bunx sanity blueprints deploy`.
- **NEC-09:** Autopsy pipeline `condense` → `propose_anatomy` → `validate` (+ one repair) → `schemaProposal` v(n+1). HQ usage fields need `schema:deploy:hq` (Taylor go). Live PNJ golden run unblocked once token fixed (below).

### Batch 3 · dataset quota → shared showcase

- Project `v9dl2xdi` plan limit: **`maxDatasets: 2`** (`hq` + `showcase`). Creating `rip-*` → `402 Quota exceeded`. Raising the quota (or NEC-10p project-per-site) deferred.
- **Decision (skip NEC-10p for now):** every séance defaults to `targetMode: 'dataset'`, `targetDataset: 'showcase'`, `visibility: 'public'`. Project mode stays in the schema/code (`--mode project` on summon) but is **not** the default.
- **One site at a time:** `showcase` holds a single resurrection. `necro.reanimate` refuses if showcase already has another séance's content unless `replaceTarget` is set (`bun run summon <url> --replace`; App confirm later). Replace wipes showcase **documents + deployed schemas** first — never touches `hq`.
- Spike cleanup (24 Sep): deleted `_.schemas.spike` from showcase; archived+deleted release `r3xHWiOV`. Left `_.schemas.nec10s-spike` on `hq` alone (do not touch hq).
- **Token gotcha:** `.env` had inline comments glued to token values (`sk…# project robot…`). Stale shell-exported `SANITY_HQ_WRITE_TOKEN` overrode `bun --env-file`. After stripping comments, project robot `necromancer-worker` auth works (200). Live summon unblocked.

### NEC-10s spike — schema deploy without Studio

**Verdict: GO** — worker `PUT https://api.sanity.io/v2025-03-01/projects/{id}/datasets/{ds}/schemas` with `ManifestSchemaType[]` + project write token. No Studio build. MCP deploy_schema NO-GO (wrong grants). Blocked for `rip-*` only by dataset quota.

### NEC-12s spike — Agent Actions × Content Releases

**Verdict: GO** — cast `transform` / `generate` on `versions.<releaseId>.<docId>` (`apiVersion: 'vX'`). Draft→release fallback also works. ~1.5–2.1s per action.
