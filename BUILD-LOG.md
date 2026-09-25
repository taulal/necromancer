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
- **NEC-09:** Autopsy pipeline `condense` → `propose_anatomy` → `validate` (+ one repair) → `schemaProposal` v(n+1). HQ usage fields need `schema:deploy:hq` (Taylor go).

### NEC-09 live golden (Caz's Kitchen, not PNJ)

- **PNJ blocked:** `https://pnjbuild.co.nz/robots.txt` now has `Disallow: /` — NecromancerBot correctly crawls 0 pages. Switched test site to [cazskitchen.co.uk](https://cazskitchen.co.uk/) (WordPress / WooCommerce).
- Full crawl (`--cap 50`) succeeded: platform `wordpress` @ 0.95, 50 pages / 15k words — then autopsy failed: (1) undeclared effect outputs stuck drain claims; (2) `compileToSchemaJson` left `fields: undefined` on object fields; (3) model put Bones names in `to[]` on arrays. Fixed compile + validate normalize; drop undeclared outputs.
- **Fast iteration path:** reuse crawl, autopsy on **5 pages** (`/`, `/about/`, `/contact/`, `/shop/`, `/media/`) with **Haiku** (`NECRO_MODEL_FAST=claude-haiku-4-5-20251001`, propose prefers FAST over REASONING). ~37s end-to-end.
- **Proposal `8pPskmVE0SMaXm7m9hxpmq` v1** on seance `8pPskmVE0SMaXm7m9hsR20`: model `claude-haiku-4-5-20251001`, **13345 in / 5021 out**, **1 repair round**. Types: `siteSettings` (singleton, phone/email/hours/delivery), `page`, `contactBlock`→Bones, `richTextBlock`→Bones, custom `shopBlock`. Haiku under-used hero/gallery vs a senior model — fine for plumbing; bump to Sonnet for the judged golden later.
- **Sanity array `_key`:** every object in an array needs a unique `_key` (and typed members need `_type`) — Content Lake rejects / Studio breaks without them across _all_ writes, not just proposals. Shared `withArrayKeys` / `arrayKey` in `@necro/hq-schema`; exhume + autopsy handlers use it at the write boundary. Primitive arrays (string/url) stay unkeyed.
- Workflow instance entombed after the first failed autopsy; proposal was written out-of-band. Next: allow re-run from entombed or `summon --cap 5` fresh after compile fixes land.

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

### NEC-UI1 · Summon drawer + Exhumation

- Summon defaults to shared `showcase` + `replaceTarget`. App-side summon uses `refDataset({projectId, dataset: hq, documentId, type: 'seance'})` as the resurrection subject (GDR `dataset:v9dl2xdi:hq:<id>`), then `fireAction(begin-exhumation)` — same as CLI but with the Dashboard session, no tokens.
- Surprise: crawl already returned `platformHits` / `chromeBlocks` but exhume never wrote them on the séance. Handler now patches them so the Exhumation rail can show evidence + chrome without a schema deploy (Content Lake accepts undeclared fields; Studio won't list them until HQ schema catches up).
- Progress bar prefers the workflow `exhumeProgress` field via `useDocumentWorkflows` → `useWorkflowSession`; falls back to seance field / pages÷cap while the instance is still resolving.
- Screenshot side-by-side with prototype deferred — Dashboard iframe not captured in this agent session.
- **Exhume drain gotcha:** returning undeclared effect `outputs` (pages/platform/…) makes `drainEffects` reject completion while the crawl already wrote pages — claim sits until lease expiry. Handlers must return void or only declared outputs.

### Org move · personal Sanity org

- Moved Necromancer to Taylor's personal org `or6mff29v` (Growth); project `v9dl2xdi` transferring there. The org ID was hardcoded in `apps/app/sanity.cli.ts`, which is why `.env` alone didn't fix Dashboard routing — now reads `SANITY_ORG_ID` from the root `.env`.
- **Empty plot on `dev:app` preview:** HashRouter was reading the Dashboard host URL/hash and falling through to the `*` route (“This plot is empty”). Switched to `MemoryRouter`; unknown paths redirect to `/`.

### NEC-UI2 · Autopsy board

- Built against batch-4 + BRIEF §8. Replaced corrupted `docs/prototype/Autopsy.dc.html` with Claude's fixed copy (was ~100k lines of duplicated SVG from a bad build script).
- Node canvas is deterministic (singletons top-right, Bones strip, documents by evidence). Inspector edits `schemaProposal.types` via `useEditDocument` (rename, merge into…, drop, toggle required, Bones mapping). Merge-hint at ≥75% field Jaccard. Version diff vs v(n−1). **Re-run autopsy** / **Accept anatomy** use `useWorkflowSession().fireAction` (not `engine.fireAction`); disabled while autopsy/rerun busy; Accept stamps `acceptedAt`.
- Surprise: `useEditDocument` path typing needs an explicit generic when HQ TypeGen isn’t wired into the App (`useEditDocument<string>({path:'acceptedAt'})`), otherwise `never`.
- Do not put generated mocks in `docs/submission/` — real Dashboard captures only (now in AGENTS.md).

### Vessel build · no `sanity` in shared packages

- `bun run build:vessel` failed: Turbopack couldn't bundle Studio into the drain server route because `packages/bones` and `packages/hq-schema` imported `defineType`/`defineField` from `sanity` (pulls `swr`'s react-server build, which has no default export). Fixed by importing from `@sanity/types` instead. AGENTS.md rule 11; CI already had `build:vessel`, plus a grep that bans `from 'sanity'` in Vessel/Functions packages.

### Netlify Vessel live

- Site: [https://the-necromancer.netlify.app/](https://the-necromancer.netlify.app/) (“Vessel is empty. Raise something.”). Unblocks NEC-07c checklist: set `VESSEL_URL` / `SANITY_APP_VESSEL_URL` to that origin, confirm CORS on `v9dl2xdi`, then Taylor **go** for `bunx sanity blueprints deploy` (needs `VESSEL_URL` + `DRAIN_SECRET` in the blueprint env).

### NEC-07c · blueprints deployed

- Stack `necromancer-functions` `<ST-9h3tm9qg2z>` org-scoped on `or6mff29v` (scheduled Functions require org scope; `SANITY_PROJECT_ID` in the shell makes `blueprints doctor` 404 the org stack — unset it for plan/deploy).
- Document Functions need `project: v9dl2xdi`. Growth plan caps cron at **hourly** (`0 * * * *`), not every minute — document kick still covers live pending work.
- Deployed: `question-gate`, `drain-kicker`, `drain-kicker-schedule` (2026-09-24).

### Drain loop (exhume→autopsy cascade)

- Kicks while the lock is held were skipped; effects queued mid-drain waited for the next kick (hourly). Fix: `runDrain` re-queries `pendingInstanceIds()` and loops until empty or ~12 min budget; on budget expiry, release lock then self-invoke background drain. Unit test: mid-drain queued effect drained in the same run (`runDrain.test.ts`).

### NEC-07c unattended test (blocked on Netlify secret)

- Summoned `https://targetcleaningsupplies.co.nz` (`--cap 5 --fast --replace --no-drain`): seance `NUTbHt8Bunvcm3fS8gPQw0`, instance `necromancer.wf-instance.356b93135c5c` @ `exhuming` with 1 unclaimed pending effect.
- Poll (~40s+): stage stayed `exhuming`, unclaimed=1 — Function did not clear work.
- Manual `POST https://the-necromancer.netlify.app/api/ritual/drain` with local `DRAIN_SECRET` → **401**. Netlify site env `DRAIN_SECRET` does not match local/.blueprint bake (or is unset). Sync Netlify production env to the same `DRAIN_SECRET` (and `VESSEL_URL`), then re-kick / re-summon and log timings.

### NEC-07c unattended test (Fri 25 Sep morning)

Séance `NUTbHt8Bunvcm3fS8gPQw0` / instance `necromancer.wf-instance.356b93135c5c` (targetcleaningsupplies, `--cap 5 --fast`).

| Step                             | Where                                           | Timing / notes                                                                                                                            |
| -------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Retry from entombed (autopsy)    | CLI `fireAction` (App closed)                   | → `autopsy` + queued `necro.autopsy`                                                                                                      |
| Netlify `drain-background` kicks | Production                                      | HTTP 202 immediately, **never claimed** effects, never wrote `necro.drainLog`                                                             |
| Autopsy drain                    | **Local** `runDrain` (contaminated the AC path) | **~47.4s** wall; model **`claude-haiku-4-5-20251001`**; **9119** input / **4208** output tokens; repairRounds **1**; proposal v1, 3 types |
| Accept anatomy                   | CLI                                             | → `interrogation` + queued `necro.interrogate`                                                                                            |
| Interrogate                      | Still a **stub**                                | Local bundled handler drained the stub → advanced toward reanimate → **entombed** (`entombedFromStage=reanimating`)                       |

Root cause for Netlify no-op: separate `*-background` function accepted requests but the workspace-import handler never ran (no `necro.drainLog`). Mitigation: pre-bundle (`build:drain-fn`, #25/#26) + Vessel `/api/ritual/drain` now runs via Next.js `after()` against the working Vessel bundle. Full unattended Netlify path still needs **NEC-11** (real `necro.interrogate`) then a fresh retry/summon.

### NEC-07c Netlify unattended (hewahihaumaru, Fri 25 Sep)

Fresh séance `hUejHG5M0oLup8cv3UxtPb` / instance `necromancer.wf-instance.2ad4d50f5e4f` (`pageCap: 3`, App closed). Kick via `POST /api/ritual/drain` only (Vessel runtime `node` / `vessel-drain`).

| Mark                               | Wall clock (UTC) | Delta                                                                                             |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `begin-exhumation` / exhume queued | 07:36:11         | t0                                                                                                |
| Exhume done (3 pages)              | 07:36:46         | **~35s**                                                                                          |
| Autopsy stage + effect queued      | 07:36:50         | ~39s                                                                                              |
| Autopsy done (proposal v1)         | 07:59:20         | **~22.5 min** (first `after()` freeze mid-Claude; completed after claim lease + schedule re-kick) |

Autopsy model/tokens: **`claude-haiku-4-5-20251001`**, **7788** input / **2328** output, repairRounds **1**.

Follow-ups shipped same morning: secret drain **awaits** (`via: await`, #29); NEC-11 real `necro.interrogate` (#28).

Interrogate (after Accept anatomy + Netlify `via: await` drain): **5 questions** written; effect completed on Vessel (`node` / `vessel-drain`). First HTTP probe hit Netlify **Inactivity Timeout** HTML while the await was still running — work finished anyway (pending cleared, questions present). Secret drain path is correct for long Claude effects; watch for gateway idle timeouts on the response.

### Loose ends (post-UI2)

- Entombed **Retry** action returns to `entombedFromStage` (set by each `*-failed` action); séance header shows Retry via `session.fireAction`.
- Summon / séance default `visibility: 'private'`; showcase dataset flipped to **private** (`sanity datasets visibility set showcase private`) until Taylor picks the public demo site.
- App router back on **HashRouter** with `path="*"` → `<Navigate to="/" />` and non-route hash scrubbing (Dashboard host junk was the empty-plot cause).
- Autopsy propose defaults to `NECRO_MODEL_REASONING` (Sonnet); Haiku only with `bun run summon … --fast` / `NECRO_AUTOPSY_FAST=1`.

### Workflow surfaces (séance diagram + Studio plugin)

- **Séance header:** `@sanity/workflow-diagram` on the resurrection instance (`useDocumentWorkflows` → `useWorkflowSession`). Current stage highlighted / visited path from `instance.history`; Ossuary `--ws-*` overrides (alive accent on bone/surface). Text stage tabs stay for navigation (`WorkflowDiagram` 0.35 has no `onStageClick`). Tabs light visited screens from history.
- **Audit trail panel:** side panel lists `instance.history` newest-first (who/what + when). Person / agent / system share one label style — no kind badges.
- **HQ Studio:** `@sanity/workflow-studio-plugin@0.35.0` (peers `sanity ^6.15`; we are on `^6.16`). Tag `necromancer`. Mappings: `seance` → `resurrection` (`autoStart: false` — App/summon starts it), `exhumedPage` → `page-ritual` for inspection. `workflowDefaultDocumentNode` adds the Workflows doc tab (inspector audit trail). Live instance list is the navbar **Workflows** tool — Taylor captures real screenshots into `docs/submission` (no mocks).
