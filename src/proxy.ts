import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Redirect Railway default domain to custom domain
  const host = request.headers.get('host');
  if (host === 'fallyx-behaviours.up.railway.app') {
    const url = request.nextUrl.clone();
    url.hostname = 'behaviours.ascenix.co';
    url.protocol = 'https';
    return NextResponse.redirect(url, 301);
  }

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

