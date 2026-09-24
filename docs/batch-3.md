# Batch 3: from "it crawls" to "it thinks" (Claude, Thu 24 Sep)

Where we are: 8 of 17 tickets done. HQ schema and workflows are deployed. Deadline Sun 4 Oct (10 days). We're about a day ahead of the brief's plan, so let's spend it on Autopsy, the part the judges score hardest.

## Order

| #   | Ticket                                                                    | Who             | Why now                                                     |
| --- | ------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| 0   | Land `claude/batch2-fixes` on main                                        | Taylor (script) | B1–B5 and B7 never made it into main (see below)            |
| 1   | **NEC-07c** Vessel on Netlify + Functions deploy                          | Taylor + Cursor | Nothing runs unattended until this lands                    |
| 2   | **NEC-08L** `summon` CLI + live exhume of the 3 test sites                | Cursor          | Real data for Autopsy to chew on                            |
| 3   | **NEC-14a** Bones catalogue (schemas only)                                | Cursor          | Autopsy maps onto it                                        |
| 4   | **NEC-09** Autopsy engine (spec below)                                    | Cursor          | The core of the entry                                       |
| 5   | **NEC-10s** spike: deploy a schema to a _target_ dataset without a Studio | Cursor          | Highest remaining technical risk                            |
| 6   | **NEC-12s** spike: Agent Actions against Content Release versions         | Cursor          | Second-highest risk                                         |
| 7   | **NEC-09b** Autopsy board + Exhumation screen, live data                  | Cursor          | Against `docs/prototype/Autopsy.dc.html` / `Exhume.dc.html` |

Items 5 and 6 are 2–3 hour spikes with a written go/no-go. They can run alongside 3–4.

---

## 0 · Why main is missing the fixes

The PRs were merged on GitHub from their original heads, so main has the PR code without my B1–B5/B7 commits. Three commits put them back on top of current main. They're verified: typecheck 11/11, tests 37/37, App and Vessel build. Run `bash ~/Desktop/Claude/projects/necromancer/push-batch2b.sh` from the repo. It only fast-forwards.

The one that matters most is **B7**: the deployed question-gate Function reads `event.data.after`, which it never receives, so it skips every event. Interrogation would never complete. Re-run the blueprint deploy after this lands (see NEC-07c).

## NEC-07c · Vessel on Netlify + Functions (Taylor + Cursor)

Taylor:

1. Netlify: new site from `taulal/necromancer`. The build command and publish dir come from `netlify.toml`, and the base directory is the repo root.
2. Env vars: `SANITY_PROJECT_ID`, `SANITY_HQ_DATASET=hq`, `SANITY_API_VERSION`, `SANITY_HQ_WRITE_TOKEN`, `SANITY_ORG_TOKEN`, `ANTHROPIC_API_KEY`, `NECRO_MODEL_REASONING`, `NECRO_MODEL_FAST`, `DRAIN_SECRET`, `DRAIN_KICK`.
3. Add the Netlify URL as a CORS origin on `v9dl2xdi` (with credentials off).
4. Set `VESSEL_URL` + `DRAIN_SECRET` for the blueprint, then `bunx sanity blueprints deploy`. **Go** once #0 is on main.

Cursor, the first-deploy checks:

- [ ] `/.netlify/functions/drain-background` responds (401 without the secret). This confirms B2.
- [ ] Workspace packages are bundled into the background function (no "Cannot find module @necro/rituals"). This confirms B3.
- [ ] Start a resurrection by hand, close every tab, and see the exhume effect claimed within 60s via the Function.

AC: an unattended exhume of pnjbuild.co.nz completes on Netlify with the App closed.

## NEC-08L · `summon` CLI + live runs (Cursor)

The Summon drawer comes later, so for now: `bun run summon <url> [--cap 50]` creates the `seance` (slug from `slugFromUrl`, `targetDataset: rip-<slug>`, visibility private), starts `resurrection` and fires `begin-exhumation`. Run it on:

| Site                         | Expect                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| pnjbuild.co.nz               | Durable adapter path. 4 pages, blocks mapped, email decoded, seo from `__NEXT_DATA__` |
| hewahihaumaru.org.nz         | WordPress, sitemap index, hits the 50-page cap                                        |
| targetcleaningsupplies.co.nz | Apex → www, `/html/*.php`, catalogue pages                                            |

AC: all three reach `autopsy` (the stub handler) with sensible `exhumedPage` docs. Paste stats and any surprises into `BUILD-LOG.md`, since real-site weirdness is write-up gold.

## NEC-14a · Bones catalogue (Cursor)

Only the object schemas, in `packages/bones/src/schemas/`, with no renderers yet. Every field has a `description`. Validation limits are kept loose; Autopsy tightens them per site.

| Block           | Fields                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `link` (object) | `label` string · `href` url **or** `internal` ref → `page` (exactly one)                                                                               |
| `hero`          | `heading` string ≤ 90 (req) · `subheading` text ≤ 240 · `image` image (hotspot, `alt` req when image set) · `primaryCta` link · `secondaryCta` link    |
| `richText`      | `body` portableText (req)                                                                                                                              |
| `mediaText`     | `heading` string · `body` portableText (req) · `image` image (req) · `imageSide` left \| right                                                         |
| `cardGrid`      | `heading` · `intro` text · **either** `cards[]` {title, body text, image, link} **or** `items[]` refs to one collection type (set per site by Autopsy) |
| `gallery`       | `heading` · `images[]` image + `alt` + `caption`                                                                                                       |
| `testimonial`   | `items[]` refs → `testimonial` docs, **or** inline {quote, name, detail}                                                                               |
| `faq`           | `heading` · `items[]` {question string, answer portableText}                                                                                           |
| `cta`           | `heading` (req) · `body` text · `button` link (req)                                                                                                    |
| `contactBlock`  | `heading` · `intro` text · `showForm` boolean. Contact facts are **read from `siteSettings`**, never stored here                                       |
| `logoStrip`     | `heading` · `logos[]` image + `alt`                                                                                                                    |
| `stats`         | `items[]` {value string, label string}                                                                                                                 |
| `embed`         | `kind` map \| video \| iframe · `url` url (req) · `title` string (req, for a11y)                                                                       |

Export `BONES_CATALOGUE`, a compact JSON description of names, purposes and field shapes. This is what Autopsy is prompted with, so write each block's `purpose` line for a model to read: "Use for the first full-width band of a page: a headline, optional supporting line and up to two calls to action."

## NEC-09 · Autopsy engine (Cursor, spec by Claude)

`necro.autopsy` (and `necro.autopsy-rerun`) → `packages/autopsy` + `packages/rituals/src/runtime/autopsyHandler.ts`. It writes `schemaProposal` v(n+1). The pipeline has four steps, and **only step 2 uses AI**.

### Step 1 · Condense (deterministic)

Build a `Corpse` object from `exhumedPage` docs:

- Per page: `pageId`, `path`, `title`, `httpStatus`, and `sections[]` as {`kind` guess, text trimmed to 600 chars, `imageCount`, `linkCount`}. Durable pages use the adapter's typed blocks instead.
- Skip `httpStatus >= 400`. Collapse chrome blocks (from `detectChrome`) into one `chrome` entry.
- **Shape clusters:** pages sharing a path prefix and a similar section signature (the same `kind` sequence, ±1) form a `cluster` with member pageIds. Examples: `/services/*`, `/products/[cat]`, `/blog/*`. This is the main evidence for proposing collection types, and it's computed by code, not guessed by the model.
- **Facts:** `detectedEntities` merged site-wide with counts per value, e.g. `phones: [{value:'021 152 6894', pages:[…]}]`.
- Budget: ≤ 60k input tokens. Truncate the longest sections first and never drop a page entirely.

### Step 2 · Propose (one Claude call, `NECRO_MODEL_REASONING`)

Tool use with a single tool, `propose_anatomy`, whose input schema _is_ `ProposedType[]` (generate the JSON schema from the TS types, e.g. with `ts-json-schema-generator` or a hand-written zod mirror). No free-text parsing.

System prompt, verbatim. This is Claude's content; keep it in `packages/autopsy/src/prompt.ts`:

> You are performing an autopsy on a website that is being moved to Sanity. You will receive a condensed dump of its pages, shape clusters computed by code, site-wide facts, and the Bones block catalogue. Propose the content model a careful senior Sanity developer would build for this site.
>
> Rules, in priority order:
>
> 1. Reuse a Bones block for every page section that fits one. Only propose a new object type when no block fits, and say which blocks you considered.
> 2. Every cluster of 3 or more pages with the same shape becomes a document type (a collection), not pages. Its index page gets a `cardGrid` that references it.
> 3. Things repeated across the site (header, footer, contact details, opening hours, social links) belong in the `siteSettings` singleton, once. Blocks reference them; they are never copied into page copy.
> 4. A fact that appears with different values on different pages is still one field. Do not create two fields to hold the disagreement. The interrogation step will ask a human which value is right.
> 5. Field names are camelCase, singular for single values, plural for arrays. Never prefix with `_`. Avoid reserved names: `type`, `id`, `document`, `image` as a type name.
> 6. Set `required` only when the value is present on at least 90% of the evidence. Set a max length at the longest observed value plus 20%, rounded up to a sensible number.
> 7. Every type needs a one-paragraph `rationale` a client could read, and at least one `evidence` item whose `excerpt` is copied **exactly** from the input.
> 8. Be honest about confidence: below 0.6 means you'd want a human to look.
> 9. Prefer fewer, well-named types over many narrow ones. If two candidate types share most fields, propose one and explain the merge in the rationale.

User message: the `Corpse` JSON, then `BONES_CATALOGUE`. On a re-run, add the previous proposal and a list of **human decisions to respect** (renames, merges, drops and toggled `required`, diffed from the prior version's edits). Rule to add: "Keep every human decision unless the new evidence contradicts it; if it does, keep it anyway and say why in the rationale."

### Step 3 · Validate + repair (deterministic)

- The `excerpt` of each evidence item must be a substring of that page's text. Drop any that aren't, and lower `confidence` by 0.2 if a type loses all its evidence.
- Names: camelCase, unique, not reserved. References `to[]` must name proposed document types. `bonesMatch` must be in `BONES`. `page.body.of` must include only Bones blocks and proposed objects.
- **Compile check:** run the proposal through `compileToSchemaJson` (NEC-10) and validate it with `@sanity/schema`'s `Schema.compile` plus `validateSchema`. Any error goes back to Claude **once** as a tool result ("fix these errors, change nothing else"), then fail the effect if it's still invalid. A proposal that doesn't compile never reaches a human.
- Always ensure `page` and `siteSettings` exist.

### Step 4 · Write

Write the `schemaProposal` doc {seance, version, types, `model`, `inputTokens`, `outputTokens`, `repairRounds`}. The last three go in the build log and write-up ("the anatomy for PNJ cost N tokens and one repair round").

### Tests

- Unit: condense (clusters and facts) on fixtures. Validator: bad excerpt, reserved name, dangling ref, unknown bone.
- **Golden run (manual, logged):** PNJ proposal vs the hand-made PNJ brief. Expect `siteSettings` with a single phone; `page` with hero/mediaText/cardGrid/testimonial/gallery/contactBlock; a `service` collection **only if** Services has repeated items with the same shape, not forced; and the Ian Fistonich testimonial. Paste the diff into `BUILD-LOG.md`.

AC: all three test sites produce a proposal that compiles, has evidence on every type, and survives a human read. Taylor and Claude check PNJ.

## NEC-10s · Spike: schema to a target dataset (Cursor, ≤ 3h)

Question: can the worker deploy a compiled schema to `rip-<slug>` so that Agent Actions and the Dashboard see it, **without** a Studio build?
Try, in order:

1. The HTTP API behind `sanity schema deploy`. Read the CLI source (`@sanity/cli` → schema deploy action) and call the same endpoint with `SANITY_ORG_TOKEN`.
2. The MCP server's `deploy_schema` tool, called from the worker.
3. Generate a temp workspace (`sanity.config.ts` + schema JSON) in `/tmp` and shell out to `sanity schema deploy`.

Write-up: which works, the payload shape, and the auth scope needed. Go/no-go in `BUILD-LOG.md`.

## NEC-12s · Spike: Agent Actions × Content Releases (Cursor, ≤ 3h)

In a scratch dataset with a deployed schema: create a release, create a doc version in it, then run `client.agent.action.transform` and `.generate` targeting the version id (`versions.<releaseId>.<docId>`).
Write-up: does it work; if not, does the fallback (draft → add to release) work; what the calls cost in tokens and time. Go/no-go in `BUILD-LOG.md`.

## NEC-09b · Screens with live data (Cursor, after NEC-09)

Exhumation and Autopsy screens against the prototype, reading real HQ docs. For the Autopsy board, the node layout can be a simple deterministic grid: singletons top-right, documents in rows by evidence count, Bones blocks as a strip. Editing (rename, merge, drop, toggle required) writes the proposal doc through `useEditDocument`. "Accept anatomy" fires the workflow action through `useWorkflowSession`.

---

## Taylor's list

1. Run `push-batch2b.sh`.
2. Netlify site + env vars (NEC-07c), then `blueprints deploy`.
3. The #8 Graveyard screenshot.
4. Knowledge Base beta toggle (sanity.io/manage → org → Apps), if not done.
5. Confirm we can use PNJ as a _private_ test.
