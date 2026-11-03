import { Skeleton } from '@/components/ui/States';

/** Route-level loading state: the page header and two columns, as skeletons. */
export default function Loading() {
  return (
    <main className="flex flex-col gap-7 px-4 pb-12 pt-5 md:px-9 md:pt-7" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-14 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-7">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col items-center gap-4">
          <Skeleton className="aspect-square w-full max-w-[660px] rounded-full" />
        </div>
        <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading the page.
      </span>
    </main>
  );
}
