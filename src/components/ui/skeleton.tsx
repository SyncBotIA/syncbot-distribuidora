import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-shimmer rounded-md bg-[length:200%_100%]', className)}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--theme-subtle-border)] p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="animate-shimmer bg-[length:200%_100%]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton className={cn('h-4', i === 0 ? 'w-32' : i === cols - 1 ? 'w-16' : 'w-24')} />
        </td>
      ))}
    </tr>
  )
}
