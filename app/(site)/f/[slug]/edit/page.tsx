import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ApostleStyleChanger } from '@/components/editor/ApostleStyleChanger';
import { EditorGate } from '@/components/editor/EditorGate';
import { GospelEditor } from '@/components/editor/GospelEditor';
import type { ApostleStyleName } from '@/components/editor/ApostleStylePicker';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { loadEditorContext } from '@/lib/server/queries/editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit gospel' };

type Props = { params: Promise<{ slug: string }> };

export default async function EditPage({ params }: Props) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/signin?callbackUrl=${encodeURIComponent(`/f/${slug}/edit`)}`);
  const client = await db();
  const faith = await client.faith.findUnique({ where: { slug }, include: { currentRevision: true, apostle: true } });
  if (!faith) notFound();
  const back = { href: `/f/${slug}`, label: faith.name };
  if (faith.prophetId !== user.id) return <EditorGate title="Edit gospel" body="Only the prophet of this faith can edit its gospel. You can fork it instead." action={{ href: `/f/${slug}/fork`, label: 'Fork this faith' }} back={back} />;
  if (faith.founderType === 'agent') return <EditorGate title="Edit gospel" body="Faiths founded by agents cannot be edited." back={back} />;
  const ctx = await loadEditorContext(user.id, 'edit', faith.id);
  if (!ctx) notFound();
  const editsLeft = Math.max(0, ctx.config.gospelEditsPerSeason - faith.editsThisSeason);
  return (
    <>
      <PhoneTopBar back={back} title="Edit gospel" />
      {faith.apostle ? (
        <div className="px-4 pt-5 md:px-9 md:pt-7">
          <ApostleStyleChanger
            faithId={faith.id}
            current={faith.apostle.style as ApostleStyleName}
            pending={(faith.apostle.pendingStyle as ApostleStyleName | null) ?? null}
            changesLeft={Math.max(0, ctx.config.apostleStyleChangesPerSeason - faith.apostle.styleChangesThisSeason)}
            apostleName={faith.apostle.name}
          />
        </div>
      ) : null}
      <GospelEditor
        mode="edit"
        config={ctx.config}
        palette={ctx.palette}
        editsLeft={editsLeft}
        faith={{ id: faith.id, slug: faith.slug, name: faith.name, body: faith.currentRevision?.body ?? '' }}
        draftSavedAt={ctx.draft?.updatedAt.toISOString() ?? null}
        initial={{ name: faith.name, body: ctx.draft?.body || faith.currentRevision?.body || '', color: faith.color, style: faith.apostle?.style as ApostleStyleName, apostleName: faith.apostle?.name ?? '' }}
      />
    </>
  );
}
