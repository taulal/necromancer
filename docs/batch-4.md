# Batch 4: finish the build (brief for Cursor, from Claude, Thu 24 Sep)

Claude is stepping back to save credits. **This brief is meant to carry you to submission on your own.** Taylor reviews and merges. When in doubt: BRIEF.md is the product, AGENTS.md is the rules, and `docs/prototype/*.dc.html` is the design.

**Dates:** feature freeze **Fri 2 Oct 18:00 UK**. Sat 3 Oct: showcase run and write-up. Sun 4 Oct: submit.

## Order (one branch + PR per ticket)

| #   | Ticket                                                              | Depends on       | Target       |
| --- | ------------------------------------------------------------------- | ---------------- | ------------ |
| 1   | NEC-09 finish + PNJ golden run                                      | token fixed      | Fri 25       |
| 2   | **NEC-UI1** Summon drawer + Exhumation screen                       | –                | Fri 25       |
| 3   | **NEC-UI2** Autopsy board                                           | NEC-09           | Sat 26       |
| 4   | NEC-11 Interrogation engine + **NEC-UI3** screen                    | NEC-09           | Sun 27       |
| 5   | NEC-12 Reanimate (into `showcase`)                                  | NEC-10s/12s (GO) | Mon 28       |
| 6   | NEC-13 Ritual (plan + cast) + **NEC-UI4** screen                    | NEC-12           | Tue 29       |
| 7   | NEC-14 Vessel renderers + 301s                                      | NEC-12           | Wed 30       |
| 8   | NEC-16 Rise + **NEC-UI5** screen                                    | 5–7              | Thu 1        |
| 9   | NEC-07c Netlify + Functions (with Taylor, whenever the site exists) | –                | before Thu 1 |
| –   | NEC-15 KB spike (stretch, only if 1–8 are green by Thu 1)           | –                | –            |

If you slip, cut in this order: KB → Ritual human step-through (keep auto-cast) → Rise slider (keep the ledger + button). **Never cut:** Autopsy board, Interrogation, the evidence on AI claims, honest build-log notes.

---

## UI rules (all screens)

- Build each screen against its prototype file. Read the `.dc.html` for layout, spacing, copy, states and interactions, then rebuild in React with Sanity UI and `apps/app/src/theme/` tokens. **Don't paste the markup.**
- **Copy is part of the design.** Use the prototype's microcopy verbatim unless it names mock data ("Nothing needs you. The dead are patient.", "Begin exhumation", "Accept anatomy", "It lives.").
- Data: `useDocuments` → handles → `useDocumentProjection`. Edits go through `useEditDocument` (on change, never save-on-submit). Workflow state and buttons come from `@sanity/workflow-sdk` `useWorkflowSession`/`useDocumentWorkflows`, and actions go through `fireAction`. **Never write workflow state by hand.**
- Every AI claim shows its evidence (URL + quote) and links to the old page.
- Motion is limited to two effects: flicker (the current stage and live items) and soil (running progress). Both switch off under `prefers-reduced-motion`.
- a11y: real `<button>`/`<a>`/`<label>`, 44px targets, visible focus (phosphor outline), text contrast per the System board.
- **Design self-check before each UI PR.** Put a screenshot next to the prototype artboard in the PR, and list any differences with a reason for each.

### NEC-UI1: Summon drawer + Exhumation (`Main.dc.html` drawer, `Exhume.dc.html`)

- The drawer does what `bun run summon` does, from the App: URL, page cap, target (default `showcase`; project mode is disabled with the note "coming soon"), visibility. If showcase is occupied, show "Showcase holds harbourview… Replace it?" with an explicit confirm that maps to `--replace`. Then "Begin exhumation" creates the séance, starts the workflow, fires `begin-exhumation` and navigates to the séance.
- Creating the séance and starting the workflow happens in the browser via the workflow SDK + App SDK with the user's own session. **No tokens.**
- Exhumation: a live sitemap tree from `exhumedPage` docs (status per page), a progress bar bound to `exhumeProgress`, and a platform card with its evidence hits. Also: "Its face, recovered" (brand colours, fonts, logo), "Things it said about itself" (entity counts, contradictions in ember), and "Repeated on every page" (chrome).
- AC: summon PNJ from the App and watch it exhume live to Autopsy.

### NEC-UI2: Autopsy board (`Autopsy.dc.html`)

- Node canvas: singletons pinned top-right; documents in rows by evidence count; Bones blocks as a strip; SVG edges for refs and `body[]`. Use a deterministic layout (no physics).
- Inspector: name, kind, confidence, rationale, the fields table (type, required, seen N/M) and evidence quotes.
- Edits write the `schemaProposal` doc: rename, merge (the drag-onto variant is optional, but "Merge into…" is required), drop, toggle required, change the Bones mapping. Show a merge-hint banner when two types share ≥ 75% of their fields.
- Show a version diff vs v(n−1) ("+1 type, 3 fields changed"). "Re-run autopsy" and "Accept anatomy" fire the workflow actions and are disabled while an autopsy effect is running.
- AC: PNJ proposal is editable, the edits survive a re-run (human decisions are respected), and Accept moves the stage.

### NEC-UI3: Interrogation (`Interrogate.dc.html`)

- A left list with answered/open markers and required ones ringed in ember. A centre card with a kind chip, the "found by Knowledge Base" badge when `source == 'knowledgeBase'`, the prompt in Fraunces, evidence quotes, answer chips + note, and "This answer creates: …" as a preview of the tasks it will spawn. Right rail: "Ritual so far".
- Answering writes `question.answer`/`answeredBy`. The gate is the question-gate Function (don't decrement anything in the App). Until Functions are deployed, a dev-only "recount" button can call the same code path through the Vessel.

### NEC-UI4: Ritual (`Ritual.dc.html`)

- Tasks grouped by page (one `page-ritual` child each) with the stage mini-path casting → reviewing → blessed. "Cast" and "Cast all auto (n)" fire actions, with soil progress. The human step-through panel reads the target doc from `showcase` (App SDK multi-dataset config) and has an "Open in Studio" deep-link. "Bless" and "Recast" are the child actions.

### NEC-UI5: Rise (`Rise.dc.html`)

- The before/after slider: the old site in an iframe if its `x-frame-options` allows it (PNJ does), otherwise the og:image or a labelled placeholder; the Vessel on the right in the release perspective. Then the redirect ledger with coverage %, the gate checklist (from workflow state) and Rise. After rising: "It lives." plus the Vessel URL.

---

## Engine tickets (short; BRIEF §7 has the detail)

### NEC-09 finish

The spec is in `docs/batch-3.md`. Run PNJ, then paste the proposal-vs-hand-brief diff, token counts and repair rounds into BUILD-LOG. Taylor deploys the HQ schema afterwards.

### NEC-11 Interrogate (`necro.interrogate`)

- **Deterministic first.** Contradictions from merged facts (same entity kind, different values across pages), missing meta/alt, pages with httpStatus ≥ 400, thin pages (< 60 words), Durable/theme boilerplate (keep a small phrase list; "Welcome to our website", "Lorem ipsum" and friends).
- **Then one Claude call** (tool `ask_questions`) for authenticity, keep-or-kill and mapping questions from low-confidence autopsy types. Each question needs evidence with an excerpt that's an exact substring (validate the same way as autopsy).
- Each question gets `required` (contradictions and authenticity are required; the rest optional), `options[]`, and `spawnsTasks` templates keyed by option.
- Set `interrogationDeadline = now + 48h` on completion; the question-gate recount runs at the end of the handler too.
- Target: 5–15 questions per site. More than 15 is noise, so rank and cap.

### NEC-12 Reanimate (`necro.reanimate`) into `showcase`

- Occupancy guard + `--replace` (already specced). Compile and `PUT` the schema (NEC-10s method). Create the release "Resurrection · <slug>". Map `exhumedPage` + the accepted proposal into target docs **as release versions** (`versions.<releaseId>.<id>`). Upload images (dataset assets; Media Library is a stretch). Write `redirect` docs + `redirectLedgerEntry` (old path → new path; merged pages 301 to their survivor).
- Deterministic mapping first (Durable blocks → Bones; clusters → collection docs). Use Claude only to fill fields the mapping can't place, and keep that capped.
- Idempotent: re-running replaces the release contents; it never duplicates.

### NEC-13 Ritual

`necro.plan-ritual` turns answers + findings into `task` docs (auto/human + a one-line "why"). `necro.cast` runs the auto tasks per page via Agent Actions on the release versions (GO from NEC-12s): Transform for placeholder copy (tone from the autopsy brand summary), Generate for alt text and meta (title ≤ 60, description ≤ 155), Patch for contact fixes and heading normalisation. Log tokens per cast.

### NEC-14 Vessel

Bones renderers (plain, styled by CSS vars from `siteSettings.brand`) + the schema-driven fallback renderer for inferred types (reads the compiled schema: string→text, image→figure, refs→cards, portableText→prose) + collection index/detail routes + `proxy.ts` 301s from `redirect` docs. `/[site]` maps to `showcase` for now. The release perspective via `?perspective=<releaseId>` drives the Rise preview.

### NEC-16 Rise

`necro.rise` publishes the release and sets `seance.status = 'risen'`. Showcase run: pick the site Taylor has consent for, set `showcase` visibility public, deploy the Vessel publicly, and record the URLs for the submission.

---

## Self-review checklist (Claude isn't reviewing, so every PR states these)

- [ ] `bun run typecheck && bun run test` green, and the touched app builds.
- [ ] No token or secret in `SANITY_APP_*` or App code; nothing written to `dyewmg78`.
- [ ] Every new effect is idempotent and has a failure path that ends somewhere (no dead stage).
- [ ] AI calls: structured output, evidence validated as exact substrings, tokens logged.
- [ ] UI: prototype screenshot side by side, microcopy matches, reduced-motion checked, keyboard path works.
- [ ] BUILD-LOG gets a dated line with what broke or surprised you. **This is judged**, so keep it honest and specific.

## Submission pack (build it alongside, don't leave it to Saturday)

- `docs/submission/`: 4–6 GIFs (Summon → Exhume, Autopsy edit + Accept, Interrogation answer → task, Cast, Rise), a 90s screen recording, and a schema diagram of HQ and of the PNJ anatomy.
- Draft the DEV post from BUILD-LOG: problem → the ritual → schema decisions with real examples → what broke → Cursor transcript excerpts → project ID `v9dl2xdi` + showcase dataset URL + Vessel URL → `#sanitychallenge`. Taylor edits the voice.
