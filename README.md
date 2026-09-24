# Necromancer

> Paste the URL of a dying website. Necromancer exhumes it, performs an autopsy to infer a proper Sanity content model, interrogates you about what it doesn't understand, reanimates the content into a fresh dataset inside a Content Release, runs the ritual of clean-up tasks (AI where it can, you where it can't), and raises it on a schema-driven Next.js front end, with every old URL 301'd home.

Sanity Challenge 2026 · Path Two · #sanitychallenge

- **App** (`apps/app`): Sanity App SDK app, lives in the org Dashboard
- **Workflows** (`packages/rituals`): Editorial Workflows engine 0.35 drives every stage
- **Vessel** (`apps/vessel`): Next.js 16 renders any resurrected dataset

Start with `BRIEF.md`, then `AGENTS.md`, then `docs/TICKETS.md`.

```bash
cp .env.example .env   # fill in
bun install
bun run typecheck && bun run test
bun run build:app && bun run build:vessel
bun run dev:app        # opens in the Sanity Dashboard
bun run dev:vessel
```
