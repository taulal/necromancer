/**
 * Default crawl size for a séance when no cap is given (summon CLI, App drawer,
 * Studio, exhume handler, crawler). Dependency-free so the App, Vessel and
 * Functions can import it. Pass an explicit cap (e.g. `--cap 50`) for bigger runs.
 */
export const DEFAULT_PAGE_CAP = 10
