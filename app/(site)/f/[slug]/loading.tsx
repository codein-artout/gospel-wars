import { Skeleton } from '@/components/ui/States';

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-3 border-b-[3px] border-lead bg-nave-deep px-4 py-8 md:px-9">
        <Skeleton className="h-16 w-[min(100%,640px)]" />
        <Skeleton className="h-5 w-[min(100%,480px)]" />
      </div>
      <div className="flex flex-wrap gap-8 px-4 py-8 md:px-9">
        <Skeleton className="h-[640px] min-w-0 flex-[3_1_520px]" style={{ borderRadius: 'var(--arch)' }} />
        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading the faith.
      </span>
    </main>
  );
}
