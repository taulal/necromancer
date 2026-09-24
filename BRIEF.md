# Necromancer — Project Brief

_Sanity Challenge 2026 · Path Two ("Vibe-code something strange") · Owner: Taylor · PM/Design: Claude · Build: Cursor agent_
_Last updated: 24 Sep 2026 (scaffold landed) · Submission deadline: **Sun 4 Oct 2026**_

> Paste a URL of a dying website. Necromancer exhumes it, performs an autopsy to infer a proper Sanity content model, interrogates you about what it doesn't understand, reanimates the content into a fresh Sanity dataset inside a Content Release, runs the ritual of clean-up tasks (AI where it can, you where it can't), and raises it on a schema-driven Next.js front end — with every old URL 301'd to its new home.

---

## 1. Why this, why now

- **Real use case.** It's `runbooks/wp-modernisation-runbook.md` turned into a product. We replatform Durable / WordPress / old PHP sites repeatedly (PNJ Build, NZ Sheds, Target Cleaning). Every hour Necromancer removes from that ~70hr "$20k website play" is margin.
- **Real test bed for Editorial Workflows.** Extends the PDF → RAG ingestion pattern proven in the sandbox (AI effect → candidates → per-item child workflow → human gate → publish) from "one PDF" to "one whole website".
- **Challenge fit.** Path Two judges on: honest build write-up, finished functionality, **schema thoughtfulness**, creativity. The product's core output *is* a schema. Bonus points for **App SDK** and **Workflows** — we use both as the spine, not as garnish.

## 2. Roles & ways of working

| Who | Role | Owns |
|---|---|---|
| **Taylor** | Product owner / approver | Decisions, real-site selection + consent, Sanity org admin actions (tokens, beta access, dataset delete), final demo + submission |
| **Claude (Cowork)** | Designer + PM | This brief, clickable HTML prototype, ticket breakdown + acceptance criteria, reviewing each Cursor PR against the brief, build log, DEV write-up draft |
| **Cursor agent** | Developer | All code in the `necromancer` repo, bench tests, deploys. Works ticket-by-ticket (§12). Starts from `flight-cursor-starter` conventions (rules, skills) but **no `@flight-digital/*` packages** |

**Loop:** Claude writes ticket → Cursor builds on a branch → Cursor posts summary + screenshots → Claude reviews against acceptance criteria → Taylor merges. Cursor keeps its chat transcripts (they're an optional-but-encouraged submission artefact). Claude maintains `BUILD-LOG.md` daily — the honest writeup is judged more heavily than polish ("a rough app with an honest writeup beats a polished one with three sentences").

**Handoff rule for Cursor:** if a ticket's premise turns out wrong (API doesn't exist, beta blocked), stop, write what you found in the PR, propose the fallback from §11. Don't silently invent around it.

## 3. Scope

### MVP (must ship by 3 Oct)
1. App SDK app deployed to the Flight org Dashboard with: Graveyard, Séance view (all stages), Autopsy board, Interrogation, Ritual list, workflow diagram.
2. Workflow definitions (engine 0.35) for the resurrection + per-page child ritual, with bench tests.
3. Exhumation of server-rendered sites (WordPress, Durable, static/PHP) up to 50 pages.
4. AI schema inference → editable proposal → compiled + deployed to a target dataset.
5. AI interrogation (questions with evidence) + generated task list (auto vs human).
6. Reanimation into a new dataset inside a **Content Release**, images uploaded, redirect ledger written.
7. Automated tasks executed via **Agent Actions**; human tasks stepped through.
8. **Vessel**: Next.js front end rendering any resurrected dataset via the open Bones block kit + schema-driven fallback renderer, serving the 301s.
9. At least 2 real sites resurrected end to end; one public showcase.

### Stretch (only if MVP is green by 1 Oct)
- **Knowledge Base contradictions** (Sanity Context KB over the dead site) — see §7.4. MVP has a Claude-only contradiction pass as fallback.
- Production mode: new **project** per site (MVP: new dataset in the sandbox project).
- Media Library as the asset home (MVP: dataset assets).
- Client-side-rendered sites (Wix/Squarespace) via headless browser.
- "Download Studio" — export compiled schema as `defineType` TS files + `sanity.config.ts`.
- Visual before/after slider using screenshots.

### Out of scope
- Te Reo / any translation.
- FlightDeck, `@flight-digital/*` packages, Flight design system or any Flight IP in the repo or Vessel.
- Auth/multi-tenant beyond what Sanity org membership gives us.
- Forms, e-commerce, search on the Vessel.

## 4. Architecture

```
┌──────────────────────────── Sanity org (oEouFCZpW) ────────────────────────────┐
│                                                                                │
│  Dashboard ── Necromancer App (App SDK, React+Vite, Sanity UI)                 │
│                 │  reads/writes HQ + every target dataset (user's own session) │
│                 │  @sanity/workflow-sdk  → useWorkflowSession / Instances      │
│                 │  @sanity/workflow-diagram → stage diagram                    │
│                 ▼                                                              │
│  Project v9dl2xdi ("sanity-sandbox")                                           │
│   ├─ dataset `hq`        séances, schema proposals, questions, tasks,          │
│   │                      workflow definitions + instances (tag: necromancer)   │
│   ├─ dataset `rip-<slug>` one per resurrected site (private by default)        │
│   ├─ dataset `showcase`  public demo resurrection for judges                   │
│   └─ Function `drain-kicker` (Blueprint) — on workflow-instance change +       │
│        schedule → POST Vessel /api/ritual/drain                                │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
                     │ POST (shared secret)
                     ▼
  Vessel (Next.js 16, Netlify)
   ├─ /api/ritual/drain   claims queued workflow effects and runs them:
   │     exhume · autopsy · interrogate · reanimate · cast (Agent Actions)
   │     (Anthropic key + Sanity robot tokens live here, server-only)
   ├─ /[site]/[[...slug]] renders a resurrected dataset (Bones + fallback)
   └─ middleware          301s from the redirect ledger
```

**Why the worker lives in the Vessel, not a Function:** crawling + multi-page Claude calls will exceed Function time limits, and it's the pattern already working in the sandbox (`src/app/api/workflows/drain`). The Function is the trigger; the Next route is the muscle. Re-evaluate if Durable Functions ship before deadline (they won't).

### Repo
New repo `necromancer` (monorepo, bun workspaces):

```
apps/app/          App SDK app (sanity.cli.ts with app.id, Sanity UI + custom theme)
apps/vessel/       Next.js 16 front end + drain worker (Next 16: `src/proxy.ts`, not middleware)
apps/studio/       internal HQ Studio — deploys HQ schema (Agent Actions/TypeGen/Dashboard need it), raw doc inspection
packages/hq-schema/ HQ content model (§6)
packages/rituals/  workflow definitions, effect handlers, bench tests (vitest)
packages/bones/    open block kit: schema types + React renderers
packages/autopsy/  schema proposal model, compiler (proposal → Sanity schema JSON / TS)
packages/exhume/   crawler, platform fingerprints, extractors
functions/         Sanity Functions + sanity.blueprint.ts
sanity.workflow.ts deploy config (workflowResource: v9dl2xdi.hq, tag: necromancer)
BRIEF.md · BUILD-LOG.md · AGENTS.md
```

Port from `sanity-sandbox` (copy, don't import): `src/workflows/{client,engine,drain,runDrain,effect-handlers}.ts` patterns, the `refId`/`asDocumentId` helpers and the README's "gotchas" list. **Pin every `@sanity/workflow-*` package to exactly `0.35.0`** (exact-version peers; latest as of 23 Sep, and the first line that pairs with `@sanity/sdk` 3.x). The sandbox was written for 0.28 — read the 0.29→0.35 CHANGELOGs in `node_modules/@sanity/workflow-engine` before porting any construct.

### Sanity project reset (Taylor-approved step, ticket NEC-01)
- Base project: **`v9dl2xdi`** (confirmed from `.env.development`). ⚠️ `flight.json` in the sandbox points at `dyewmg78` — that's the **Flight website**. Never touch it.
- Delete dataset `v9dl2xdi/production` (irreversible — Taylor runs or explicitly approves the command). `showcase` ✅ created by Taylor 24 Sep (check it's set **public**). Create `hq` (private). `rip-*` datasets are created by the app.
- The sandbox repo itself stays as-is on disk (it's the Flight site codebase — not published).

## 5. The ritual — workflow design

### 5.1 Parent: `resurrection` (subject: `seance`)

```
summoned ─▶ exhuming ─▶ autopsy ─▶ interrogation ─▶ reanimating ─▶ ritual ─▶ risen
   │           │           │            │                               │
   │           └─(failed)──┴────────────┴──────────▶ entombed (off-ramp: abandoned/failed)
   └─ start.requirements: singleSubject (one open run per séance)
```

| Stage | Entry work | Human gate | Exit when |
|---|---|---|---|
| `summoned` | — | "Begin exhumation" button (confirm URL, page cap, target mode) | action fired |
| `exhuming` | effect `necro.exhume` (progress field `exhumeProgress`) | — | `$effectStatus['necro.exhume'] == 'done'` |
| `autopsy` | effect `necro.autopsy` → writes `schemaProposal` | Reviewer edits proposal in Autopsy board, then **"Accept anatomy"** | action fired; guard freezes proposal after |
| `interrogation` | effect `necro.interrogate` → writes `question` docs | every `required` question answered (gate: GROQ count of open required questions == 0) | trigger |
| `reanimating` | effect `necro.reanimate`: create dataset → deploy schema → create release → import docs as release versions → upload assets → write `redirect` docs; then effect `necro.plan-ritual` → writes `task` docs | — | both effects `done` |
| `ritual` | **fan-out**: one `page-ritual` child per target page (`forEach` over pages) | tasks worked in children | all children settled (`$subworkflows`) |
| `risen` | action "Rise" → effect `necro.rise` publishes the release | Rise button (roles: administrator/editor) | terminal |

Plus: **SLA trigger** — if `interrogation` sits > 48h, move séance `status` to `haunted` (flag only, no stage change) and highlight in Graveyard. Uses the `$now` deadline pattern from the sandbox.

### 5.2 Child: `page-ritual` (lifecycle: `child`, subject: target page ref)
```
casting ─▶ reviewing ─▶ blessed
   ▲            │
   └─(recast)───┘
```
- `casting`: triggered action runs every **auto** task for this page (effect `necro.cast`, Agent Actions). Progress via `ctx.setProgress`.
- `reviewing`: human tasks for this page listed as a step-through; guard freezes AI-touched fields until reviewer approves or sends back ("Recast" → back to casting with stage-scoped `note`).
- `blessed`: terminal. Parent only sees settled/active (per sandbox README design note) — page outcome written to `task.status` so the parent's Rise gate can query it.

### 5.3 Engine gotchas to carry over (from sandbox README, found on 0.28 — re-verify on 0.35)
1. `forEach` reads `$fields.subject._id`, not `.id`.
2. Actor ids must be account-global (`g…` users, `p-…` robots).
3. Duplicate start throws `StartNotAllowedError`.
4. `expectedMinReaderModel` on every deployment (was 4 on 0.28 — confirm the 0.35 floor).
5. Bind document ids, never hydrated asset objects, into effect params.

## 6. HQ content model (dataset `hq`)

This is the schema judges will read. Everything is a document so it's queryable, auditable and drivable by workflow.

| Type | Purpose | Key fields |
|---|---|---|
| `seance` | One resurrection attempt | `url`, `slug`, `platform` (enum: wordpress/durable/wix/squarespace/webflow/static/unknown + `confidence`), `targetMode` (dataset\|project), `targetDataset`, `targetProjectId`, `visibility` (private\|public), `pageCap`, `brand` {colors[], fonts[], logo}, `stats` {pages, images, words, links}, `status` (display: alive/haunted/risen/entombed), `startedBy` |
| `exhumedPage` | Raw evidence per crawled URL | `seance`↗, `url`, `path`, `httpStatus`, `title`, `meta` {description, ogImage, canonical}, `headings[]`, `sections[]` {kind guess, html excerpt, text}, `images[]` {src, alt, w, h}, `links[]`, `detectedEntities` {phones[], emails[], addresses[], prices[]}, `contentHash` |
| `schemaProposal` | The inferred anatomy (editable) | `seance`↗, `version`, `types[]` → `proposedType` |
| `proposedType` (object) | One doc/object type | `name`, `title`, `kind` (document\|object\|singleton), `bonesMatch` (Bones block name or null), `fields[]` → `proposedField`, `rationale`, `evidence[]` (exhumedPage↗ + excerpt), `confidence`, `decision` (keep/merge/drop) + `mergeInto` |
| `proposedField` (object) | | `name`, `type`, `of[]`, `to[]`, `required`, `validation` {max, min, regex}, `description`, `evidenceCount` |
| `question` | Interrogation item | `seance`↗, `kind` (contradiction/authenticity/keep-or-kill/mapping/missing-info), `prompt`, `evidence[]` {page↗, quote, url}, `options[]`, `answer`, `answeredBy`, `required`, `source` (claude\|knowledgeBase), `spawnsTasks` |
| `task` | Ritual to-do | `seance`↗, `page` (target doc id), `mode` (auto\|human), `action` (enum: rewrite-placeholder, generate-alt, generate-meta, fix-contact, normalise-headings, map-block, verify-testimonial, supply-asset, custom), `agentAction` {kind: generate/transform/patch, instruction, target paths}, `status` (todo/casting/done/failed/skipped), `fromQuestion`↗, `result` |
| `redirectLedgerEntry` | 301 map | `seance`↗, `from`, `to`, `status` (mapped/unmapped/dropped) |

Target datasets (`rip-*`, `showcase`) get: `siteSettings` (singleton: name, contact, brand tokens, nav), `page` (slug + `body[]` of Bones blocks), inferred collection types (e.g. `service`, `product`, `teamMember`, `post`, `testimonial`), `redirect`.

## 7. AI touchpoints

Model: current Claude Sonnet for reasoning steps, Haiku for cheap classification; confirm model IDs at build. All calls server-side in the Vessel worker. Every AI output that makes a claim carries **evidence** (page ref + quote) — same discipline as TouchGrass `sourceQuote`. Use tool-use/structured output, never free-text parsing.

### 7.1 Exhume (`necro.exhume`)
- Fetch `robots.txt`, `sitemap.xml` (+ index), fall back to link crawl from `/`; same-origin; respect `pageCap` (default 50); 5 concurrent.
- Platform fingerprints (from the runbook): `wp-content/`, `wp-json/`, generator meta → WordPress; `cdn.durable.co` → Durable; `static.wixstatic.com` → Wix; `squarespace.com` → Squarespace; `webflow.com` → Webflow.
- Parse with cheerio; strip nav/footer by repetition detection across pages (a block that appears on >70% of pages = chrome → `siteSettings` candidate).
- Regex + Haiku pass for entities (NZ/AU/UK phone formats, emails, addresses, prices).
- Brand extraction: top colours from CSS custom props / computed frequency, font-family stacks, logo (`<img>` in header / `og:image` / favicon).
- Write `exhumedPage` docs + `seance.stats`. Report progress per page.

### 7.2 Autopsy (`necro.autopsy`) — the schema thoughtfulness engine
- Input: condensed `exhumedPage` sections (dedup by `contentHash`), the Bones catalogue (names + field shapes), and rules:
  1. **Reuse Bones blocks first** for page sections; only propose a new *object* type when no block fits.
  2. **Repeated structured things become document types** (3+ instances with same shape → collection: services, products, team, testimonials, posts).
  3. **Chrome becomes a singleton** (`siteSettings`, `navigation`).
  4. **Facts live once** (phone/email/address in `siteSettings`, referenced, never duplicated in page copy).
  5. Validation from evidence (max lengths from observed + 20%, required if present on >90%).
  6. Every type has a `rationale` and `evidence`.
- Output `schemaProposal` v1. Re-running writes v2 (keep history — nice for the writeup).

### 7.3 Interrogate (`necro.interrogate`)
Generates `question` docs. Kinds:
- **contradiction** — same entity, different values across pages (phones, hours, prices, addresses).
- **authenticity** — template/placeholder copy (Durable/theme boilerplate detection), stock testimonials, lorem ipsum.
- **keep-or-kill** — thin/orphan/duplicate pages, stale blog posts, 404s linked internally.
- **mapping** — low-confidence type/block mappings from autopsy.
- **missing-info** — no meta descriptions, missing alt text, no contact page.
Each answer can `spawnsTasks` (e.g. "021 152 6894 is correct" → auto task fix-contact across 4 pages).

### 7.4 Knowledge Base (stretch, but the headline if it works)
- Build a Sanity Context **Knowledge Base** with the dead site URL as a source. KBs "identify contradictions in and between sources" with origins — exactly the contradiction question kind, with provenance from Sanity rather than our prompt.
- Questions from the KB get `source: knowledgeBase` and a distinct badge in the UI.
- **Taylor action:** enable KB beta in sanity.io/manage → org → Apps. **Spike first (NEC-15):** confirm a KB can be created and read programmatically (MCP endpoint) from the worker. If not → Claude-only contradiction pass (already MVP) and we say so honestly in the writeup.

### 7.5 Plan ritual (`necro.plan-ritual`)
Turns answers + findings into `task` docs, classified `auto` (has a deterministic Agent Action recipe) vs `human` (judgement or missing asset). Every task has a one-line "why".

### 7.6 Cast (`necro.cast`) — Agent Actions on target docs
| Task action | Agent Action | Notes |
|---|---|---|
| rewrite-placeholder | **Transform** | instruction includes brand tone summary from autopsy; field paths scoped |
| generate-alt | **Generate** (image fields) | needs image field setup per docs |
| generate-meta | **Generate** | title ≤ 60, description ≤ 155 |
| fix-contact / normalise-headings | **Patch** (no LLM) | schema-aware, deterministic |
| custom | **Prompt** → then Patch | fallback |
Requires the target schema to be **deployed** first (hence reanimate before ritual). **Spike (NEC-12):** confirm Agent Actions can target release versions; if not, cast on drafts and add docs to the release after.

## 8. The App (App SDK) — screens

Design direction: **dark, occult, precise.** Near-black base, bone-white type, one sickly accent (phosphor green `#9DFF6B`-ish) for "alive/active", ember orange for warnings. Monospace for data (URLs, field names), a serif display face for titles. Tasteful — a tool you'd actually use, with the theme in the micro-copy and motion (candle-flicker on active stages, soil-particle fill on progress). Built on Sanity UI primitives with a custom theme; Tailwind allowed for layout. Respect `prefers-reduced-motion`. Full specs + clickable prototype: **`prototype/` (Claude, NEC-02)**.

1. **Graveyard** (home) — grid of tombstones, one per séance across HQ. Shows domain, platform sigil, stage, page count, "died" (last-modified header / copyright year found), who's present (App SDK presence — UK and NZ at the same séance). Filters: stage, platform, haunted. "Summon" CTA → URL input + options.
2. **Séance** (detail shell) — header with workflow diagram (`@sanity/workflow-diagram`, current stage glowing, visited path lit), stage tabs below, activity log (workflow audit trail) in a side panel.
3. **Exhumation** — live sitemap tree growing as pages land; per-page status chips; platform verdict with evidence; brand swatch strip extracted.
4. **Autopsy board** — the showpiece. Node graph of proposed types (documents large, objects small, singletons pinned), edges for references. Click a type → field table with evidence excerpts and confidence. Actions: rename, merge (drag onto another), drop, toggle required, change Bones mapping. Diff view vs previous version. "Accept anatomy" fires the workflow action.
5. **Interrogation** — one question at a time, card-style. Evidence panel (quote + source URL, opens old page). Answer chips + free text. Progress "7 of 12 · 3 required left". KB-sourced questions badged.
6. **Ritual** — task list grouped by page (one group per `page-ritual` child). Auto tasks show a **Cast** button + live progress; human tasks are a step-through (field editor inline via App SDK `useEditDocument`, or deep-link to target doc). Filters: auto/human/failed.
7. **Rise** — preview (Vessel iframe of the release perspective), redirect ledger table with 301 coverage %, and the Rise button.

## 9. Vessel (Next.js) + Bones

**No Flight IP.** The Vessel proves the *schema*, not our design system.

- **Bones** (`packages/bones`) — a small, open, deliberately plain block kit. Each block = Sanity object schema + React renderer: `hero`, `richText`, `mediaText`, `cardGrid`, `gallery`, `testimonial`, `faq`, `cta`, `contactBlock`, `logoStrip`, `stats`, `embed`. Plus `page`, `siteSettings`, `redirect`. Styling via CSS variables fed from `siteSettings.brand` — **the corpse keeps its face** (its own colours, fonts and logo).
- **Schema-driven fallback renderer** — for inferred types Bones doesn't know (e.g. `service`, `product`), the Vessel reads the séance's compiled schema and renders by field type: string→heading/text, image→figure, array of refs→card list, portable text→prose, number+currency-ish→price. Collection types get auto index + detail routes. This is how the front end *shows the schema* rather than hiding it.
- Routing: `/[site]/[[...slug]]` where `site` → target dataset. Showcase gets a clean domain route.
- Perspectives: published by default; `?perspective=<releaseId>` for the Rise preview.
- Middleware serves 301s from `redirect` docs (cache per dataset).
- Hosts the drain worker (`/api/ritual/drain`, secret-authenticated).

## 10. Security & config
- Browser (App): user's Sanity session only. **No tokens in the App bundle.** Only `SANITY_APP_*` non-secret vars.
- Worker (Vessel, Netlify env): `ANTHROPIC_API_KEY`, `SANITY_HQ_WRITE_TOKEN`, `SANITY_ORG_TOKEN` (org robot: create datasets/projects, deploy schemas), `DRAIN_SECRET`.
- Function → Vessel calls signed with `DRAIN_SECRET`.
- Crawler: same-origin only, page cap, 10s timeout per page, polite UA `NecromancerBot (+url)`, honour robots.txt.
- Public exposure: only `showcase` dataset is public. HQ and `rip-*` stay private (real client content + our AI's opinions of it).

## 11. Risks & fallbacks

| Risk | Likelihood | Fallback |
|---|---|---|
| Workflows 0.x breaking change mid-build | Med | Pinned to 0.35.0 exact; no upgrades until after submission |
| Agent Actions can't target release versions | Med | Cast on drafts, then add to release |
| No programmatic schema deploy API (only CLI/MCP) | Med | Worker calls the same HTTP endpoint the CLI uses (spike in NEC-10), or runs `sanity schema deploy` against a generated temp workspace |
| KB beta not accessible / not API-drivable | Med-High | Claude contradiction pass (MVP); document honestly |
| Crawl too slow / blocked | Med | Sitemap-first, cap 50, cache HTML in `exhumedPage` so reruns don't refetch |
| Judges can't log into our org to use the App | High | Public `showcase` dataset + public Vessel URL + GIFs/video + Cursor transcripts in the post |
| Real client content in public | Low (if we follow §10) | `showcase` uses a consenting or Flight-owned site only |
| Scope creep vs 10 days | High | §3 cut line; Claude calls it daily in the build log |

## 12. Plan & tickets

| Day | Date | Focus |
|---|---|---|
| D0 | Thu 24 – Fri 25 Sep | Brief ✔, prototype, NEC-01…04 |
| D1–2 | Sat 26 – Sun 27 | Exhume + HQ schema + workflow definitions + bench |
| D3–4 | Mon 28 – Tue 29 | Autopsy + Interrogation (worker + screens) |
| D5–6 | Wed 30 – Thu 1 Oct | Reanimate, Ritual/Agent Actions, Vessel |
| D7 | Fri 2 Oct | Real-site runs, bug bash, stretch if green |
| D8 | Sat 3 Oct | Showcase run, GIFs/video, writeup final |
| — | Sun 4 Oct | Buffer + submit |

Each ticket: branch `nec-XX-short-name`, PR with summary, screenshots, and "deviations from brief".

- **NEC-01 Project reset** — delete `v9dl2xdi/production` (Taylor approves), create `hq` (private) + `showcase` (public). AC: `sanity dataset list` shows only `hq`, `showcase`; `dyewmg78` untouched.
- **NEC-02 Prototype** (Claude) — clickable HTML of Graveyard, Séance/Autopsy, Interrogation, Ritual. AC: Taylor sign-off.
- **NEC-03 Repo scaffold** — monorepo per §4, `AGENTS.md` from flight-cursor-starter rules minus Flight IP, CI typecheck + vitest. AC: `bun test` green, App runs in Dashboard locally.
- **NEC-04 App SDK shell + theme** — Sanity UI theme per §8, routing for 7 screens, deploy to org Dashboard (`sanity deploy`, app.id saved). AC: visible to Flight org members in Dashboard.
- **NEC-05 HQ schema** — §6 types as schema + TypeGen. AC: types deployed to `hq`; GROQ types generated.
- **NEC-06 Workflow definitions** — `resurrection` + `page-ritual` per §5 with bench tests for: happy path, exhume failure → entombed, autopsy re-run, required-question gate, fan-out settle, recast loop, SLA haunted flag, duplicate start blocked. AC: all bench paths green; `workflows:deploy` to `hq` tag `necromancer`.
- **NEC-07 Drain worker + Function kicker** — Vessel `/api/ritual/drain`, Blueprint Function on instance change + 1-min schedule, App-side kicker while open. AC: queued effect claimed within 60s with App closed.
- **NEC-08 Exhume** — §7.1. AC: 3 real sites (1 WP, 1 Durable, 1 static/PHP) exhumed with correct platform + entities; progress bar live.
- **NEC-09 Autopsy** — §7.2 + Autopsy board. AC: proposal for each test site passes a human sniff test; merge/rename/drop persist; accept fires action.
- **NEC-10 Schema compiler + deploy** — proposal → Sanity schema JSON (+ TS export behind flag); deploy to target dataset. Spike deploy API first. AC: target dataset shows deployed schema; Agent Actions accept it.
- **NEC-11 Interrogation** — §7.3 + screen. AC: ≥1 real contradiction found on a test site; answering all required questions advances the stage.
- **NEC-12 Reanimate** — dataset create, release create, import as versions, assets, redirects. Spike release-version + Agent Actions compat. AC: release visible in target; nothing published; ledger ≥95% mapped.
- **NEC-13 Ritual** — plan-ritual + cast + step-through screen + page-ritual children. AC: auto tasks complete via Agent Actions with results logged; recast loop works.
- **NEC-14 Vessel + Bones** — §9. AC: resurrected test site renders with its brand tokens; an inferred collection type renders via fallback; 301s work.
- **NEC-15 KB spike** (stretch) — §7.4. AC: go/no-go note in build log.
- **NEC-16 Rise + showcase** — Rise publishes release; showcase run on public dataset; Vessel public. AC: judges can load showcase URL + query public dataset.
- **NEC-17 Writeup** (Claude + Taylor) — DEV post: problem, the ritual, schema decisions with examples, what broke (honest), Cursor transcript excerpts, project ID `v9dl2xdi` + showcase dataset URL, `#sanitychallenge`.

## 13. Demo script (for the post + video)
1. Graveyard → Summon a real dead Durable site.
2. Watch the sitemap tree grow; platform sigil lands on "Durable, 97%".
3. Autopsy: "it found 6 services → made a `service` document type, not six pages" (schema thoughtfulness moment). Merge two near-duplicate types live.
4. Interrogation: "Home says one phone number, Contact says another" → answer → spawns a fix task.
5. Ritual: Cast → placeholder copy rewritten via Agent Actions; step through a "verify testimonial" human task.
6. Rise preview: old site vs Vessel, same brand, clean structure; redirect ledger 100%.
7. Rise.

## 14. Open decisions (Taylor)
1. **Repo visibility** — public (helps judging, shows the Workflows code) vs private (Necromancer as future Flight IP). Recommend **public for the challenge**, relicense later if it becomes a product — nothing Flight-proprietary is in it.
2. **Real test sites** — which 2–3? And which one (consenting or Flight-owned) goes in the public `showcase`?
3. **Submission team** — solo or add an NZ dev (up to 4)?

## Appendix — reference
- Sandbox: `~/Documents/Personal projects/sanity-sandbox` — `src/workflows/README.md` (engine patterns + gotchas), `sanity.workflow.ts`, `src/app/api/workflows/drain`.
- Runbook: `Claude/runbooks/wp-modernisation-runbook.md` (platform detection, extraction, redirects).
- Sanity docs: App SDK (sanity.io/docs/app-sdk), App SDK deployment, Agent Actions, Schema deployment, Functions, MCP server (mcp.sanity.io — has create_dataset/deploy_schema/create_release tools, useful reference for the underlying APIs).
- Challenge: dev.to/challenges/sanity-2026-09-16
