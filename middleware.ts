import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.next() // no password set → open access

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6))
    const colonIndex = decoded.indexOf(':')
    const pwd = colonIndex !== -1 ? decoded.slice(colonIndex + 1) : decoded
    if (pwd === password) return NextResponse.next()
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="NoteVault"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
