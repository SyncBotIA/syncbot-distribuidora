import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
        secondary: 'border-[var(--theme-subtle-border)] bg-[var(--theme-subtle-bg)] text-muted-foreground',
        destructive: 'border-red-500/20 bg-red-500/10 text-red-400',
        outline: 'text-secondary-foreground border-[var(--theme-subtle-border-hover)] bg-[var(--theme-subtle-bg)]',
        success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
