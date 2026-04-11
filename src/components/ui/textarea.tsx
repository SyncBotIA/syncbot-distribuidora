import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-xl border border-[var(--theme-subtle-border)] bg-[var(--theme-subtle-bg)] px-3.5 py-2.5 text-sm text-foreground ring-offset-background transition-all duration-200 placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/30 focus-visible:bg-[var(--theme-subtle-bg-hover)]',
          'hover:border-[var(--theme-subtle-border-hover)] hover:bg-[var(--theme-subtle-bg-hover)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
