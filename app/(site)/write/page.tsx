import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EditorGate } from '@/components/editor/EditorGate';
import { GospelEditor } from '@/components/editor/GospelEditor';
import type { ApostleStyleName } from '@/components/editor/ApostleStylePicker';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { getSessionUser } from '@/lib/auth/session';
import { loadEditorContext, STARTER_GOSPEL } from '@/lib/server/queries/editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Write a gospel' };

export default async function WritePage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?callbackUrl=/write');
  const ctx = await loadEditorContext(user.id, 'new');
  if (!ctx) return <EditorGate title="Write a gospel" body="No world exists yet. Seed the database first." />;
  if (ctx.mine) {
    return (
      <EditorGate
        title="Write a gospel"
        body={`You already have a faith this season: ${ctx.mine.name}. A prophet holds one faith per season.`}
        action={{ href: `/f/${ctx.mine.slug}/edit`, label: 'Edit your gospel' }}
      />
    );
  }
  const d = ctx.draft;
  const firstFree = ctx.palette.find((p) => !p.taken)?.hex ?? null;
  return (
    <>
      <PhoneTopBar back={{ href: '/', label: 'The Nave' }} title="Write a gospel" />
      <GospelEditor
        mode="new"
        config={ctx.config}
        palette={ctx.palette}
        draftSavedAt={d?.updatedAt.toISOString() ?? null}
        initial={{
          name: d?.name ?? '',
          body: d?.body || STARTER_GOSPEL,
          color: d?.color && !ctx.palette.find((p) => p.hex === d.color)?.taken ? d.color : firstFree,
          style: (d?.style as ApostleStyleName | null) ?? 'Scholar',
          apostleName: d?.apostleName ?? '',
        }}
      />
    </>
  );
}
