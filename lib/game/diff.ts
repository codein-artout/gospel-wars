import { parseGospel, splitLines } from './gospel';

export type LineOp = { op: 'same' | 'add' | 'del'; text: string; aLine?: number; bLine?: number };

/** Line-level diff via LCS (gospels are at most a few hundred lines). */
export function lineDiff(a: string, b: string): LineOp[] {
  const A = splitLines(a);
  const B = splitLines(b);
  const n = A.length;
  const m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = norm(A[i]!) === norm(B[j]!) ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: LineOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(A[i]!) === norm(B[j]!)) {
      out.push({ op: 'same', text: B[j]!, aLine: i + 1, bLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ op: 'del', text: A[i]!, aLine: i + 1 });
      i++;
    } else {
      out.push({ op: 'add', text: B[j]!, bLine: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ op: 'del', text: A[i]!, aLine: ++i });
  while (j < m) out.push({ op: 'add', text: B[j]!, bLine: ++j });
  return out;
}

function norm(line: string): string {
  return line.trim();
}

/**
 * Share of lines changed between parent and fork: max(added, removed) over the larger
 * non-blank line count. Blank lines are ignored so padding can't fake a schism.
 */
export function changeRatio(parent: string, fork: string): number {
  const ops = lineDiff(parent, fork).filter((o) => o.text.trim() !== '');
  const added = ops.filter((o) => o.op === 'add').length;
  const removed = ops.filter((o) => o.op === 'del').length;
  const aLines = splitLines(parent).filter((l) => l.trim()).length;
  const bLines = splitLines(fork).filter((l) => l.trim()).length;
  const denom = Math.max(aLines, bLines);
  return denom === 0 ? 0 : Math.max(added, removed) / denom;
}

/** Doctrine numbers whose text differs between parent and fork (or exist in only one). */
export function changedDoctrines(parent: string, fork: string): number[] {
  const a = parseGospel(parent).doctrines;
  const b = parseGospel(fork).doctrines;
  const max = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let n = 1; n <= max; n++) {
    const x = a.find((d) => d.number === n)?.text.trim();
    const y = b.find((d) => d.number === n)?.text.trim();
    if (x !== y) out.push(n);
  }
  return out;
}

export function diffSummary(parent: string, fork: string): { added: number; removed: number; changedDoctrines: number[]; ratio: number } {
  const ops = lineDiff(parent, fork);
  return {
    added: ops.filter((o) => o.op === 'add' && o.text.trim()).length,
    removed: ops.filter((o) => o.op === 'del' && o.text.trim()).length,
    changedDoctrines: changedDoctrines(parent, fork),
    ratio: changeRatio(parent, fork),
  };
}
