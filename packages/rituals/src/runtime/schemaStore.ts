/**
 * Deploy a schema to a target dataset without a Studio (NEC-10s: GO).
 * Same endpoint + payload as `sanity schema deploy` (@sanity/cli services/schemas.ts).
 */
export const TARGET_WORKSPACE = 'default'
export const TARGET_SCHEMA_ID = `_.schemas.${TARGET_WORKSPACE}`
/** CURRENT_WORKSPACE_SCHEMA_VERSION in @sanity/cli-build. */
const WORKSPACE_SCHEMA_VERSION = '2025-05-01'

export async function deployTargetSchema(opts: {
  projectId: string
  dataset: string
  token: string
  types: Array<Record<string, unknown>>
  title: string
}): Promise<string> {
  const res = await fetch(
    `https://api.sanity.io/v2025-03-01/projects/${opts.projectId}/datasets/${opts.dataset}/schemas`,
    {
      method: 'PUT',
      headers: {Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        schemas: [
          {
            schema: opts.types,
            version: WORKSPACE_SCHEMA_VERSION,
            workspace: {name: TARGET_WORKSPACE, title: opts.title},
          },
        ],
      }),
    },
  )
  if (!res.ok) {
    throw new Error(
      `Schema deploy to ${opts.dataset} failed: ${res.status} ${(await res.text()).slice(0, 300)}`,
    )
  }
  return TARGET_SCHEMA_ID
}
