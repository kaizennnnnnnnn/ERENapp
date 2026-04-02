import { NextResponse, type NextRequest } from 'next/server'

// Middleware is intentionally minimal — auth is handled client-side in (app)/layout.tsx
export async function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
