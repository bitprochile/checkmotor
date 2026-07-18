import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'taller_session'
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/whatsapp/webhook']

interface ProxyPayload { superadmin?: boolean }

async function verifyToken(token: string): Promise<ProxyPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '')
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return payload as unknown as ProxyPayload
  } catch {
    return null
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifyToken(token) : null

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (session && pathname.startsWith('/tenant') && !session.superadmin) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
