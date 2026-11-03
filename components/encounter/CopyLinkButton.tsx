'use client';

import { useToast } from '../ui/Toast';

export function CopyLinkButton({ path, className }: { path: string; className?: string }) {
  const { show } = useToast();
  return (
    <button
      type="button"
      className={`btn btn-quiet ${className ?? ''}`}
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        try {
          await navigator.clipboard.writeText(url);
          show('Link copied.');
        } catch {
          show(`Copy this link: ${url}`);
        }
      }}
    >
      Copy link
    </button>
  );
}
