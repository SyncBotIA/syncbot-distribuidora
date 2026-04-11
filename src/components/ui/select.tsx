import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            'flex h-10 w-full rounded-xl border border-[var(--theme-subtle-border)] bg-[var(--theme-subtle-bg)] px-3.5 py-2 pr-9 text-sm text-foreground ring-offset-background transition-all duration-200 appearance-none cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/30 focus-visible:bg-[var(--theme-subtle-bg-hover)]',
            'hover:border-[var(--theme-subtle-border-hover)] hover:bg-[var(--theme-subtle-bg-hover)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          ref={ref}
          style={{ colorScheme: 'inherit' }}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
