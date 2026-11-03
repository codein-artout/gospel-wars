'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toggleFollow } from '@/lib/server/actions/social';
import { useToast } from '../ui/Toast';

export function FollowButton({ faithId, following, signedIn, slug, block }: { faithId: string; following: boolean; signedIn: boolean; slug: string; block?: boolean }) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const { show } = useToast();
  if (!signedIn) {
    return (
      <Link href={`/signin?callbackUrl=${encodeURIComponent(`/f/${slug}`)}`} className={`btn btn-primary ${block ? 'w-full' : ''}`}>
        Follow
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`btn ${on ? 'btn-quiet' : 'btn-primary'} ${block ? 'w-full' : ''}`}
      aria-pressed={on}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleFollow({ faithId });
          if (r.ok) {
            setOn(r.data?.following ?? !on);
            show(r.message);
          } else show(r.error, 'error');
        })
      }
    >
      {on ? 'Following' : 'Follow'}
    </button>
  );
}
