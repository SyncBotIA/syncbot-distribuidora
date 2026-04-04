import * as React from 'react'
import { cn } from '@/lib/utils'

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c1225] px-3.5 py-2 text-sm text-white ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 appearance-none cursor-pointer [&>option]:bg-[#0c1225] [&>option]:text-white [&>option]:py-2',
          className
        )}
        ref={ref}
        style={{ colorScheme: 'dark' }}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
