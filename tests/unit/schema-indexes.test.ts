import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every foreign key must be the leading column of some index, primary key or unique constraint. */
describe('schema indexes', () => {
  const dir = path.join(process.cwd(), 'prisma', 'migrations');
  const sql = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readFileSync(path.join(dir, d.name, 'migration.sql'), 'utf8'))
    .join('\n');

  const leading = new Map<string, Set<string>>();
  const add = (table: string, col: string) => {
    const set = leading.get(table) ?? new Set<string>();
    set.add(col);
    leading.set(table, set);
  };
  for (const m of sql.matchAll(/CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([^"]+)"\("([^"]+)"/g)) add(m[1]!, m[2]!);
  for (const m of sql.matchAll(/CREATE TABLE "([^"]+)" \(([\s\S]*?)\n\);/g)) {
    const pk = /PRIMARY KEY \("([^"]+)"/.exec(m[2]!);
    if (pk) add(m[1]!, pk[1]!);
  }
  const fks = [...sql.matchAll(/ALTER TABLE "([^"]+)" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("([^"]+)"\)/g)].map((m) => ({
    table: m[1]!,
    column: m[2]!,
  }));

  it('finds foreign keys to check', () => {
    expect(fks.length).toBeGreaterThan(30);
  });

  it.each(fks.map((f) => [`${f.table}.${f.column}`, f]))('%s is indexed', (_label, f) => {
    expect(leading.get(f.table)?.has(f.column), `${f.table}.${f.column} has no index`).toBe(true);
  });
});
