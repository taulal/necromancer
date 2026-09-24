# Tickets

Owner key: **C** = Cursor, **Cl** = Claude, **T** = Taylor. Status: ⬜ todo · 🟨 in progress · ✅ done · ⛔ blocked.
Full context for every ticket is in `BRIEF.md`. The section numbers below (§) refer to it.

**Batch 1 (start now, no UI dependency):** NEC-03 → NEC-05 → NEC-06 → NEC-07 → NEC-08.
Claude is designing in parallel (NEC-02). Don't build screens beyond the NEC-04 shell until the prototype lands.

---

## ✅ NEC-00 Scaffold (Cl)
Monorepo, workspace packages, App SDK app shell, Vessel shell, internal Studio, workflow deploy config, docs. Verified in a clean Linux env: `bun install`, `typecheck`, `test`, app build, Vessel build, Studio build all green.

## ⬜ NEC-01 Project reset (T)
Run these from `apps/studio`:
- [ ] Delete `v9dl2xdi/production`: `bun x sanity datasets delete production --force -p v9dl2xdi`. **Irreversible**, and `--force` skips the prompt, so double-check the project id first.
- [ ] Create `hq` as private: `bun x sanity datasets create hq --visibility private -p v9dl2xdi`
- [ ] Confirm `showcase` is **public**: `bun x sanity datasets visibility get showcase -p v9dl2xdi` (set it with `... visibility set showcase public`)
- [ ] Add CORS origin `http://localhost:3000` (Vessel dev) and the Netlify URL when known
- [ ] Create tokens → `.env` (see `.env.example`): `SANITY_HQ_WRITE_TOKEN` (project, editor), `SANITY_ORG_TOKEN` (org robot)
- [ ] Enable the Knowledge Base beta: sanity.io/manage → org → Apps (for NEC-15)

AC: `bun x sanity datasets list -p v9dl2xdi` shows `hq` and `showcase` only. `dyewmg78` untouched.

## 🟨 NEC-02 Prototype (Cl)
Clickable HTML prototype of Graveyard, Séance + workflow diagram, Autopsy board, Interrogation, Ritual, Rise. Goes in `docs/prototype/` plus a hosted link. AC: Taylor sign-off.

## ⬜ NEC-03 Make the scaffold yours (C)
- [ ] On macOS: `bun install`, `bun run typecheck`, `bun run test`. Fix anything platform-specific.
- [ ] `bun run dev:app` → open the printed Dashboard URL (Taylor signs in) and confirm "graveyard / Not yet raised." renders inside the Dashboard.
- [ ] `bun run dev:studio` → confirm the Studio loads against `hq` (after NEC-01).
- [ ] Add CI (`.github/workflows/ci.yml`): bun install, typecheck, test, build app + vessel. No deploys.
- [ ] Add husky + commitlint (conventional commits) + prettier (config is in root `package.json`).

AC: CI green on the first PR. Screenshot of the app inside the Dashboard.

## ⬜ NEC-04 App shell, routing + theme (C, after NEC-02 lands)
Router for the 7 screens (§8). Theme tokens from the prototype mapped into `apps/app/src/theme/NecroUI.tsx` (`buildTheme` overrides + CSS vars). Graveyard lists `seance` docs with `useDocuments`. First Dashboard deploy (Taylor approves).
AC: deployed app visible to Flight org members in the Dashboard; Graveyard shows seed séances live.

## ⬜ NEC-05 HQ content model (C)
Implement §6 in `packages/hq-schema`: `seance`, `exhumedPage`, `schemaProposal` + `proposedType` / `proposedField` objects, `question`, `task`, `redirectLedgerEntry`.
- Every type and field gets a `description`. This is the schema judges read, so write the descriptions for a human.
- Enums as `options.list` with titles. Sensible validation (URL fields validate as URLs; `confidence` 0–1).
- References: `seance` from every child type; `question.fromQuestion` / `task.fromQuestion`.
- Previews that make the Studio readable (e.g. séance shows domain + platform + stage).
- `bun run schema:deploy:hq` (Taylor-approved), then `bun --cwd apps/studio run typegen` → commit `sanity.types.ts`.

AC: Studio shows all types; a hand-made séance with 2 pages, 1 proposal, 2 questions and 3 tasks is readable. Types generated.

## ⬜ NEC-06 Workflow definitions + bench (C)
In `packages/rituals/src/definitions`: `resurrection` (parent) and `page-ritual` (child), exactly per §5.1–5.2, using effect names from `src/effects/names.ts`.
- Start by reading `node_modules/@sanity/workflow-engine/CHANGELOG.md` for 0.29 → 0.35, and note grammar changes vs the sandbox in the PR.
- Reference implementation (0.28): `~/Documents/Personal projects/sanity-sandbox/src/workflows/pdf-content-ingestion.ts` + its README gotchas. Copy patterns, don't import.
- Bench tests (`@sanity/workflow-engine-test`) for: happy path; exhume failed → `entombed`; autopsy re-run; required-question gate; ritual fan-out settle; recast loop; SLA → `haunted` flag; duplicate start → `StartNotAllowedError`.
- Update `expectedMinReaderModel` in `sanity.workflow.ts` to whatever 0.35 requires.

AC: all bench paths green in CI. `bun run workflows:deploy` dry run output pasted in the PR. The real deploy waits for Taylor's go.

## ⬜ NEC-07 Drain worker + kicker (C)
- Port `engine.ts` / `drain.ts` / `runDrain.ts` / `client.ts` from the sandbox into `packages/rituals/src/runtime/`, against 0.35.
- `apps/vessel/src/app/api/ritual/drain/route.ts`: auth via `DRAIN_SECRET`, claim + run effects, return a summary.
- Effect handler registry with stub handlers that just mark done (real ones land in later tickets). Use `ctx.setProgress` in stubs so progress bars can be shown early.
- `functions/drain-kicker` + `sanity.blueprint.ts`: document Function on workflow-instance changes in `hq` + 1-minute schedule. Check the current `@sanity/blueprints` / `@sanity/functions` API before writing. The existing file is a placeholder.
- App-side kicker hook (poll every 5s while a séance screen is open). The Function is the safety net.

AC: start a `resurrection` instance by hand, and with the App closed a queued stub effect is claimed within 60s via the Function.

## ⬜ NEC-08 Exhume (C)
`packages/exhume` + `necro.exhume` handler (§7.1): robots → sitemap(s) → link-crawl fallback, same-origin, `pageCap` (default 50), concurrency 5. Platform detection (extend `fingerprints.ts` with headers + confidence). Chrome detection (block on >70% of pages → `siteSettings` candidate). Entities (NZ/AU/UK phones, emails, addresses, prices; regex first, Haiku only to classify ambiguous ones). Brand (colours, font stacks, logo). Writes `exhumedPage` docs + `seance.stats`, with progress per page. Cache HTML so a rerun doesn't refetch.

AC: three real sites (1 WordPress, 1 Durable, 1 static/PHP; Taylor supplies URLs) exhume with the correct platform, entities and brand. Unit tests for the extractors against saved fixtures.

---

## Later batches (spec'd in BRIEF, detailed when we get there)
- ⬜ NEC-09 Autopsy: inference + Autopsy board (§7.2, §8.4)
- ⬜ NEC-10 Schema compiler + deploy to target. **Spike the deploy API first** (§11)
- ⬜ NEC-11 Interrogation (§7.3, §8.5)
- ⬜ NEC-12 Reanimate. **Spike release versions + Agent Actions compatibility** (§7.6)
- ⬜ NEC-13 Ritual: plan + cast + step-through (§7.5–7.6, §8.6)
- ⬜ NEC-14 Vessel + Bones + fallback renderer + 301s (§9)
- ⬜ NEC-15 Knowledge Base spike, go/no-go (§7.4). Stretch
- ⬜ NEC-16 Rise + showcase (§8.7)
- ⬜ NEC-17 DEV write-up (Cl + T)
