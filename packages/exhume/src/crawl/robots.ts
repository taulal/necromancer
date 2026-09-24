import robotsParser from 'robots-parser'
import {fetchText, USER_AGENT} from './http'

export async function loadRobots(origin: string, body?: string) {
  const robotsUrl = new URL('/robots.txt', origin).toString()
  if (body !== undefined) return robotsParser(robotsUrl, body)
  try {
    const res = await fetchText(robotsUrl)
    if (!res.ok) return robotsParser(robotsUrl, '')
    return robotsParser(robotsUrl, res.body)
  } catch {
    return robotsParser(robotsUrl, '')
  }
}

export function isAllowed(robots: ReturnType<typeof robotsParser>, url: string): boolean {
  try {
    return robots.isAllowed(url, USER_AGENT) !== false
  } catch {
    return true
  }
}
