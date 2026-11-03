import Link from 'next/link';
import type { ShellUser } from './types';

export function SignedInCard({ user }: { user: ShellUser | null }) {
  if (!user) {
    return (
      <div className="flex flex-col gap-2 rounded-control border border-hairline p-3.5">
        <span className="text-[13px] text-faint">Not signed in</span>
        <Link href="/signin" className="font-semibold">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-hairline p-3.5">
      <span className="text-[13px] text-faint">Signed in as</span>
      <span className="font-semibold">@{user.handle}</span>
      {user.faith ? (
        <Link href={`/f/${user.faith.slug}`} className="text-[13px] text-gold no-underline hover:underline">
          Prophet of the {user.faith.name.replace(/^(The|Church of the|Order of the|Congregation of the|Brethren of the)\s+/, '')}
        </Link>
      ) : (
        <span className="text-[13px] text-muted">No faith this season</span>
      )}
      <Link href="/signout" className="text-[13px] text-muted">
        Sign out
      </Link>
    </div>
  );
}
