/**
 * Workflow definitions deployed to hq under the `necromancer` tag.
 * TODO(NEC-06): implement per BRIEF.md §5 —
 *   resurrection:  summoned → exhuming → autopsy → interrogation → reanimating → ritual → risen (+ entombed)
 *   page-ritual:   casting ⇄ reviewing → blessed   (lifecycle: 'child', one per target page)
 * Port patterns from sanity-sandbox/src/workflows/pdf-content-ingestion.ts, but check every
 * construct against the 0.35 CHANGELOG first (sandbox was written for 0.28).
 */
export const definitions = [] as const
