// Generates the Prisma client after install. Skips quietly when the schema
// does not exist yet (fresh scaffold) so `pnpm install` never fails on it.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (existsSync('prisma/schema.prisma')) {
  execSync('prisma generate', { stdio: 'inherit' });
}
