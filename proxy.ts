import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { baseAuthConfig } from '@/lib/auth/config';
import { authSecret } from '@/lib/auth/secret';

/** Route guard: signed-out visitors to write, edit, fork and admin pages go to /signin. Pages and actions re-check. */
const { auth } = NextAuth({ ...baseAuthConfig, secret: authSecret() });

export default auth((req) => {
  if (req.auth?.user) return NextResponse.next();
  const url = new URL('/signin', req.nextUrl.origin);
  url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ['/write', '/admin/:path*', '/f/:slug/edit', '/f/:slug/fork'],
};
