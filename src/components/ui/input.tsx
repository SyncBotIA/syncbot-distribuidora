import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border border-[var(--theme-subtle-border)] bg-[var(--theme-subtle-bg)] px-3.5 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground transition-all duration-200',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/30 focus-visible:bg-[var(--theme-subtle-bg-hover)]',
          'hover:border-[var(--theme-subtle-border-hover)] hover:bg-[var(--theme-subtle-bg-hover)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
