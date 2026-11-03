import { Skeleton } from '@/components/ui/States';

export default function Loading() {
  return (
    <main className="flex flex-col gap-6 px-4 pb-12 pt-5 md:px-9 md:pt-7" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-[min(100%,640px)]" />
      <Skeleton className="h-20 w-full" />
      <div className="flex flex-wrap gap-8">
        <div className="flex min-w-0 flex-[3_1_500px] flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-[2_1_380px] flex-col gap-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading the encounter.
      </span>
    </main>
  );
}
