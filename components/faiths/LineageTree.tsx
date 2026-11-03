import Link from 'next/link';
import { GlassPane } from '../glass/GlassPane';

export type LineageNode = {
  id: string;
  slug: string;
  name: string;
  color: string;
  founderType: 'human' | 'agent';
  description: string;
  current?: boolean;
  children: LineageNode[];
};

function Node({ node, depth }: { node: LineageNode; depth: number }) {
  const agent = node.founderType === 'agent';
  return (
    <li
      className="flex flex-col"
      style={
        depth > 0
          ? { marginLeft: 26, paddingLeft: 14, borderLeft: `2px ${agent ? 'dashed' : 'solid'} var(--edge)` }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <GlassPane color={node.color} width={16} height={26} lead={agent ? 'agent' : 'solid'} />
        <div className="flex flex-col gap-0.5 pb-[18px]">
          {node.current ? (
            <span className="font-bold" aria-current="page">
              {node.name}
            </span>
          ) : (
            <Link href={`/f/${node.slug}`} className="font-bold text-text no-underline hover:underline">
              {node.name}
            </Link>
          )}
          <span className="text-[13px] text-muted">{node.description}</span>
        </div>
      </div>
      {node.children.length > 0 ? (
        <ol className="m-0 flex list-none flex-col p-0">
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

/** Vertical tree. Human forks join with a solid rule; agent schisms with a dashed rule and dashed gold lead. */
export function LineageTree({ root }: { root: LineageNode }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      <Node node={root} depth={0} />
    </ol>
  );
}
