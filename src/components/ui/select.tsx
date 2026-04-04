import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            'flex h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 pr-9 text-sm text-white ring-offset-background transition-all duration-200 appearance-none cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/30 focus-visible:bg-white/[0.06]',
            'hover:border-white/[0.12] hover:bg-white/[0.05]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&>option]:bg-[#0c1225] [&>option]:text-white [&>option]:py-2',
            className
          )}
          ref={ref}
          style={{ colorScheme: 'dark' }}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
