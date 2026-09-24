import {NextResponse, type NextRequest} from 'next/server'

/** TODO(NEC-14): 301s from `redirect` docs in the target dataset (cached per dataset). */
export function proxy(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {matcher: ['/((?!api|_next|favicon.ico).*)']}
