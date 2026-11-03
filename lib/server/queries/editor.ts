import type { GlassOption } from '@/components/editor/GlassColorPicker';
import { db } from '@/lib/db/client';
import type { GameConfig } from '@/lib/game/config';
import { loadWorldHeader } from './common';

export const STARTER_GOSPEL = `# The Gospel of the Unnamed Faith

> One line that a listener would remember.

## Doctrines

1. The first thing your faith holds true.
2. The second thing, said plainly.
3. The thing agents will argue with.

## Practices

- Something the faithful do every day.
- Something they never do.

## Promise

What the faith offers to those who join.
`;

export async function loadEditorContext(userId: string, kind: 'new' | 'edit' | 'fork', faithId?: string) {
  const client = await db();
  const header = await loadWorldHeader(client);
  if (!header) return null;
  const [active, draft, mine] = await Promise.all([
    client.faith.findMany({ where: { worldId: header.id, status: 'active' }, select: { color: true, name: true } }),
    client.gospelDraft.findUnique({ where: { userId_kind_faithKey: { userId, kind, faithKey: kind === 'new' ? '' : (faithId ?? '') } } }),
    client.faith.findFirst({ where: { worldId: header.id, prophetId: userId, status: { in: ['active', 'queued'] } }, select: { slug: true, name: true } }),
  ]);
  const taken = new Map(active.map((f) => [f.color.toUpperCase(), f.name]));
  const palette: GlassOption[] = header.config.glassPalette.map((c) => ({ name: c.name, hex: c.hex, taken: taken.has(c.hex.toUpperCase()) }));
  return { header, config: header.config as GameConfig, palette, draft, mine };
}
