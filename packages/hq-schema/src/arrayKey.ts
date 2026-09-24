/**
 * Sanity requires a unique `_key` on every object (and typed member) in an array.
 * Primitive arrays (string, number, url) do not need keys.
 *
 * Always stamp keys at the write boundary — never rely on the API to invent them.
 */
export function arrayKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

type WithKey<T> = T & {_key: string}

/**
 * Map an array of objects into Sanity array members with unique `_key`s.
 * When `typeName` is set, each member also gets `_type` (typed `of: [{type: …}]`).
 */
export function withArrayKeys<T extends object>(
  items: readonly T[] | null | undefined,
  typeName?: string,
): WithKey<T>[] {
  if (!items?.length) return []
  return items.map((item) => {
    const existing = (item as {_key?: unknown})._key
    const key = typeof existing === 'string' && existing.length > 0 ? existing : arrayKey()
    if (typeName) {
      return {...item, _type: typeName, _key: key} as WithKey<T>
    }
    return {...item, _key: key} as WithKey<T>
  })
}
