import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login, reset-password, and unauthorized pages
  if (
    pathname === '/login' ||
    pathname === '/reset-password' ||
    pathname === '/unauthorized' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets')
  ) {
    return NextResponse.next();
  }

  // Redirect root to login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // All other routes require authentication (handled client-side with Firebase)
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

