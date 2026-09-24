const SEANCE_PATH = /^\/seance\/[^/]+(?:\/(?:exhumation|autopsy|interrogation|ritual|rise)?)?\/?$/

/** Keep only Graveyard / séance stage hashes; wipe Dashboard host junk. */
export function isAppRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0] || '/'
  return path === '/' || SEANCE_PATH.test(path)
}
