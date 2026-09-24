/**
 * Map resurrection workflow stages to séance screen paths (BRIEF §8.2).
 * Intermediate engine stages (summoned, reanimating, entombed) fold into the
 * nearest product surface.
 */
export const STAGE_SCREENS = [
  {path: 'exhumation', label: 'Exhume', stages: ['summoned', 'exhuming']},
  {path: 'autopsy', label: 'Autopsy', stages: ['autopsy']},
  {path: 'interrogation', label: 'Interrogate', stages: ['interrogation']},
  {path: 'ritual', label: 'Ritual', stages: ['reanimating', 'ritual']},
  {path: 'rise', label: 'Rise', stages: ['rising', 'risen']},
] as const

export type StageScreenPath = (typeof STAGE_SCREENS)[number]['path']

const STAGE_TO_PATH: Record<string, StageScreenPath> = Object.fromEntries(
  STAGE_SCREENS.flatMap((s) => s.stages.map((stage) => [stage, s.path])),
) as Record<string, StageScreenPath>

/** Resolve a workflow stage name to its séance screen path, if any. */
export function pathForWorkflowStage(stage: string | undefined): StageScreenPath | undefined {
  if (!stage) return undefined
  return STAGE_TO_PATH[stage]
}

/** Paths whose underlying workflow stages appear in instance history. */
export function visitedScreenPaths(
  history: readonly Record<string, unknown>[],
): Set<StageScreenPath> {
  const visited = new Set<StageScreenPath>()
  for (const entry of history) {
    for (const key of ['stage', 'fromStage', 'toStage'] as const) {
      const name = entry[key]
      if (typeof name === 'string') {
        const path = pathForWorkflowStage(name)
        if (path) visited.add(path)
      }
    }
  }
  return visited
}
