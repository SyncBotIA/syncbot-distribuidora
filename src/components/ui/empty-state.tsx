import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 animate-fade-in', className)}>
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] flex items-center justify-center mb-5">
        <Icon className="h-8 w-8 text-zinc-600" />
      </div>
      <p className="text-sm font-semibold text-zinc-300">{title}</p>
      {description && <p className="text-xs text-zinc-500 mt-1.5">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
