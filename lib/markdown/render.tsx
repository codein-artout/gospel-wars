import type { Element, ElementContent, Root, RootContent } from 'hast';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Gospel markdown to React. Untrusted input is parsed with remark, converted to HAST without
 * raw HTML, sanitized with a narrow allowlist, then rendered as React elements. There is no
 * `dangerouslySetInnerHTML` anywhere in this path.
 */

const SCHEMA = {
  ...defaultSchema,
  tagNames: ['h1', 'h2', 'h3', 'h4', 'p', 'blockquote', 'ol', 'ul', 'li', 'em', 'strong', 'code', 'hr', 'br', 'del'],
  attributes: { ol: ['start'] },
  protocols: {},
  clobberPrefix: 'gospel-',
  strip: ['script', 'style'],
};

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeSanitize, SCHEMA);

export type Disputed = { number: number; note: string };

export type RenderedGospel = {
  title: string | null;
  tagline: string | null;
  body: ReactNode;
};

function textOf(node: RootContent | ElementContent | Root): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) return (node.children as (RootContent | ElementContent)[]).map(textOf).join('');
  return '';
}

function isEl(n: RootContent | ElementContent | undefined, tag?: string): n is Element {
  return !!n && n.type === 'element' && (tag === undefined || n.tagName === tag);
}

export function parseToHast(markdown: string): Root {
  const mdast = processor.parse(markdown);
  return processor.runSync(mdast) as Root;
}

/**
 * Renders a gospel. The first H1 and the blockquote right after it are lifted out as
 * title and tagline (the panel styles them); disputed doctrine items get a highlight and note.
 */
export function renderGospel(markdown: string, opts: { disputed?: Disputed[]; compact?: boolean } = {}): RenderedGospel {
  const tree = parseToHast(markdown);
  const children = tree.children.filter((c) => !(c.type === 'text' && c.value.trim() === ''));
  let title: string | null = null;
  let tagline: string | null = null;
  const first = children[0];
  if (isEl(first, 'h1')) {
    title = textOf(first);
    children.shift();
    const next = children[0];
    if (isEl(next, 'blockquote')) {
      tagline = textOf(next).trim();
      children.shift();
    }
  }

  // Mark disputed doctrines: the ordered list that follows a "Doctrines" heading (or the first <ol>).
  const disputed = new Map((opts.disputed ?? []).map((d) => [d.number, d.note]));
  if (disputed.size > 0) {
    let target: Element | undefined;
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (isEl(c) && /^h[2-4]$/.test(c.tagName) && /doctrine/i.test(textOf(c))) {
        target = children.slice(i + 1).find((x): x is Element => isEl(x, 'ol'));
        break;
      }
    }
    target ??= children.find((x): x is Element => isEl(x, 'ol'));
    if (target) {
      const start = Number(target.properties?.start ?? 1) || 1;
      let n = start;
      for (const li of target.children) {
        if (!isEl(li, 'li')) continue;
        const note = disputed.get(n);
        if (note) {
          li.properties = { ...li.properties, dataDisputed: 'true' };
          li.children.push({
            type: 'element',
            tagName: 'span',
            properties: { className: ['disputed-note'] },
            children: [{ type: 'text', value: ` ${note}` }],
          });
        }
        n++;
      }
    }
  }

  const body = toJsxRuntime({ type: 'root', children } as Root, {
    Fragment,
    jsx,
    jsxs,
    components: {
      // Heading levels shift down one: the page owns the h1, the gospel title renders as h2.
      h1: (p) => <h3 className="gospel-h3">{p.children}</h3>,
      h2: (p) => <h3 className="gospel-h3">{p.children}</h3>,
      h3: (p) => <h4 className="gospel-h4">{p.children}</h4>,
      h4: (p) => <h4 className="gospel-h4">{p.children}</h4>,
    },
  });
  return { title, tagline, body };
}

/** Plain text of a markdown string (used for previews and meta descriptions). */
export function markdownToText(markdown: string): string {
  return textOf(parseToHast(markdown)).replace(/\s+/g, ' ').trim();
}
