# AGENTS.md — Necromancer

Guidance for AI coding agents (Cursor) working in this repo. Read `BRIEF.md` first; it is the source of truth. This file is the rulebook.

## What this is

Sanity Challenge 2026 entry (Path Two). An **App SDK app** in the Sanity org Dashboard that resurrects dying websites into a clean Sanity content model, driven end to end by **Editorial Workflows**, with a **Next.js "Vessel"** that renders the result. Deadline: **Sun 4 Oct 2026**.

## Roles

- **Taylor**: product owner. Merges PRs. Only person who runs destructive or org-level commands.
- **Claude (Cowork)**: designer + PM. Writes tickets (`docs/TICKETS.md`), the prototype (`docs/prototype/`), reviews PRs, keeps `BUILD-LOG.md`.
- **You (Cursor)**: developer. One ticket per branch: `nec-XX-short-name`.

## Map

| Path                                             | What                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `apps/app`                                       | App SDK app (React + Vite via `sanity dev`, Sanity UI). Renders only inside the Dashboard.      |
| `apps/vessel`                                    | Next.js 16 front end + `/api/ritual/drain` worker. Next 16 uses `src/proxy.ts`, not middleware. |
| `apps/studio`                                    | Internal HQ Studio. Exists to deploy the HQ schema and inspect raw docs. Not a product surface. |
| `packages/rituals`                               | Workflow definitions, effect handlers, drain runtime. Bench tests live here.                    |
| `packages/exhume`                                | Crawler, platform fingerprints, extractors.                                                     |
| `packages/autopsy`                               | Schema proposal model + compiler.                                                               |
| `packages/bones`                                 | Open block kit (schemas + renderers).                                                           |
| `packages/hq-schema`                             | HQ content model.                                                                               |
| `functions/drain-kicker` + `sanity.blueprint.ts` | Sanity Function that pokes the drain route.                                                     |
| `sanity.workflow.ts`                             | `sanity-workflows deploy` config (hq dataset, tag `necromancer`).                               |

Workspace packages are **source-only** (`exports` → `src/index.ts`). There's no build step; Vite and Next transpile them.

## Commands

```bash
bun install
bun run typecheck        # all workspaces
bun run test             # vitest (packages/*/src/**/*.test.ts)
bun run dev:app          # prints a Dashboard URL; a human must sign in
bun run dev:vessel       # http://localhost:3000
bun run dev:studio       # internal HQ Studio
bun run workflows:deploy # Taylor-approved only
```

Before every PR: `bun run typecheck && bun run test` are green, and the relevant app builds (`bun run build:app`, `bun run build:vessel`).

## Hard rules

1. **No Flight IP.** No `@flight-digital/*` packages, no FlightDeck, no Linaria, no Flight design tokens. The repo may go public.
2. **No secrets in the browser.** The App bundle only sees `SANITY_APP_*` values, and those must be non-secret. Tokens and the Anthropic key live only in Vessel server code and Netlify env. `SANITY_APP_DRAIN_KICK` is **public-by-design**: any Dashboard user can read it. The Vessel treats it as a low-privilege kick (pending-only drain, single-flight lock ≥10s effective, never tick-all). Never put `DRAIN_SECRET` or write tokens in `SANITY_APP_*`.
3. **Never touch project `dyewmg78`.** It's the Flight website. Our project is `v9dl2xdi`.
4. **No destructive or org-level commands** (dataset delete, app/workflow/Function/schema deploy to shared datasets) without Taylor saying "go" in the ticket or PR.
5. **Workflows packages are exact-version peers.** Every `@sanity/workflow-*` must be exactly `0.35.0`. Never bump one alone.
6. **The engine is 0.x.** Before using a construct from the sandbox (written for 0.28), check `node_modules/@sanity/workflow-engine/CHANGELOG.md`. If behaviour differs from the brief, write it in the PR.
7. **Every AI claim carries evidence** (page ref + quote). Use structured output / tool use, never free-text parsing.
8. **Effects bind document ids, never hydrated asset objects.** See the gotchas in BRIEF §5.3.
9. **Crawler etiquette:** same-origin only, honour robots.txt, page cap, 10s timeout, UA `NecromancerBot`.
10. **If the brief is wrong, stop and say so** in the PR with the fallback from BRIEF §11. Don't silently invent around it.

## App SDK essentials

- If the Sanity MCP server is available, call `get_sanity_rules` with `app-sdk` before writing SDK code.
- Data hooks suspend: one fetching hook per component, wrap in `<Suspense>`, and always pass a `fallback` to `SanityApp`.
- Lists → `useDocuments` handles → `useDocumentProjection`. Edits → `useEditDocument` on change. Never `useState`-then-save.
- Use `documentId` as the React key.
- Workflows in the app: `@sanity/workflow-sdk` (`useWorkflowSession`, `useWorkflowInstances`, `useDocumentWorkflows`) and `@sanity/workflow-diagram`.
- First deploy: `bun run --filter @necro/app deploy -- --create --title "Necromancer" --yes --json`, then save `application.id` to `deployment.appId` in `apps/app/sanity.cli.ts`. Taylor approves this.

## Design

Build against `docs/prototype/` (from Claude) and BRIEF §8: dark, occult, precise, with the theme carried in copy and motion, not clutter. Use Sanity UI primitives with the custom theme in `apps/app/src/theme/`. Respect `prefers-reduced-motion`.

## PR template

```
## NEC-XX: title
What changed:
How I tested: (commands + screenshots/GIF of the Dashboard/Vessel)
Deviations from brief: (or "none")
Build-log notes: (anything surprising, broken or learned — Claude uses this for the writeup)
```

Keep your chat transcripts. They're a submission artefact.
