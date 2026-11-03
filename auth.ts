import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { magicLinkProvider } from '@/lib/auth/email';
import { baseAuthConfig } from '@/lib/auth/config';
import { uniqueHandle } from '@/lib/auth/handles';
import { authSecret, devLoginEnabled } from '@/lib/auth/secret';
import { db } from '@/lib/db/client';

const DevLogin = z.object({ email: z.email().max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const client = await db();
  // @auth/prisma-adapter types against @prisma/client; our generated client has the same model API.
  const base = PrismaAdapter(client as unknown as Parameters<typeof PrismaAdapter>[0]);
  const adapter: Adapter = {
    ...base,
    async createUser(user: AdapterUser) {
      const email = user.email.toLowerCase();
      const created = await client.user.create({
        data: { email, name: user.name ?? null, image: user.image ?? null, emailVerified: user.emailVerified ?? null, handle: await uniqueHandle(client, email) },
      });
      return { id: created.id, email: created.email, emailVerified: created.emailVerified, name: created.name, image: created.image };
    },
  };

  const providers: Provider[] = [magicLinkProvider()];
  if (devLoginEnabled()) {
    providers.push(
      Credentials({
        id: 'dev',
        name: 'Dev login',
        credentials: { email: { label: 'Email', type: 'email' } },
        async authorize(raw) {
          const parsed = DevLogin.safeParse(raw);
          if (!parsed.success) return null;
          const email = parsed.data.email.toLowerCase();
          const existing = await client.user.findUnique({ where: { email } });
          const user =
            existing ??
            (await client.user.create({ data: { email, emailVerified: new Date(), handle: await uniqueHandle(client, email) } }));
          if (user.banned) return null;
          return { id: user.id, email: user.email, name: user.name };
        },
      }),
    );
  }

  return { ...baseAuthConfig, secret: authSecret(), adapter, providers };
});
