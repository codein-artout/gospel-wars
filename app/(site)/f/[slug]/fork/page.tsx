import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { EditorGate } from '@/components/editor/EditorGate';
import { GospelEditor } from '@/components/editor/GospelEditor';
import type { ApostleStyleName } from '@/components/editor/ApostleStylePicker';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { loadEditorContext } from '@/lib/server/queries/editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fork this faith' };

type Props = { params: Promise<{ slug: string }> };

export default async function ForkPage({ params }: Props) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/signin?callbackUrl=${encodeURIComponent(`/f/${slug}/fork`)}`);
  const client = await db();
  const parent = await client.faith.findUnique({ where: { slug }, include: { currentRevision: true } });
  if (!parent || parent.hidden) notFound();
  const back = { href: `/f/${slug}`, label: parent.name };
  if (parent.prophetId === user.id) return <EditorGate title="Fork this faith" body="You cannot fork your own faith. Edit it instead." action={{ href: `/f/${slug}/edit`, label: 'Edit gospel' }} back={back} />;
  if (parent.status !== 'active') return <EditorGate title="Fork this faith" body="Only active faiths can be forked." back={back} />;
  const ctx = await loadEditorContext(user.id, 'fork', parent.id);
  if (!ctx) notFound();
  if (ctx.mine) return <EditorGate title="Fork this faith" body={`You already have a faith this season: ${ctx.mine.name}. A prophet holds one faith per season.`} back={back} />;
  const parentBody = parent.currentRevision?.body ?? '';
  const d = ctx.draft;
  const firstFree = ctx.palette.find((p) => !p.taken)?.hex ?? null;
  return (
    <>
      <PhoneTopBar back={back} title="Fork this faith" />
      <GospelEditor
        mode="fork"
        config={ctx.config}
        palette={ctx.palette}
        faith={{ id: parent.id, slug: parent.slug, name: parent.name, body: parentBody }}
        draftSavedAt={d?.updatedAt.toISOString() ?? null}
        initial={{
          name: d?.name ?? `The Reformed ${parent.shortName.split(' ').pop() ?? parent.shortName}`,
          body: d?.body || parentBody,
          color: d?.color && !ctx.palette.find((p) => p.hex === d.color)?.taken ? d.color : firstFree,
          style: (d?.style as ApostleStyleName | null) ?? 'Zealot',
          apostleName: d?.apostleName ?? '',
        }}
      />
    </>
  );
}
