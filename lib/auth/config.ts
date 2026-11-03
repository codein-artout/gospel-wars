import type { NextAuthConfig } from 'next-auth';

/**
 * The part of the Auth.js config that needs no database: used by the proxy (route guard)
 * and extended in auth.ts with the adapter and providers.
 */
export const baseAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/signin', verifyRequest: '/signin/check', error: '/signin' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
