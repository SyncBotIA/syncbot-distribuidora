import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712] disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.97]',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 hover:from-blue-500 hover:to-blue-400 border border-blue-500/20',
        destructive:
          'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/20 hover:shadow-red-500/30 hover:from-red-500 hover:to-red-400 border border-red-500/20',
        outline:
          'border border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white hover:border-white/[0.15] shadow-sm backdrop-blur-sm',
        secondary:
          'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.10] hover:text-white border border-white/[0.04]',
        ghost:
          'text-zinc-400 hover:bg-white/[0.06] hover:text-white',
        link:
          'text-blue-400 underline-offset-4 hover:underline hover:text-blue-300',
      },
      size: {
        default: 'h-11 px-5 py-2 min-h-[44px]',
        sm: 'h-10 rounded-lg px-3.5 text-xs min-h-[44px]',
        lg: 'h-12 rounded-xl px-8 text-base min-h-[44px]',
        icon: 'h-11 w-11 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
