import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
        onClick={() => onOpenChange(false)}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).dataset.overlay === 'true') {
            onOpenChange(false)
          }
        }}
      />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:justify-center sm:p-4">
        {children}
      </div>
    </div>
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }>(
  ({ className, children, onClose, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative z-50 w-full max-w-lg rounded-t-2xl rounded-b-none border-t border-x border-white/[0.08] border-b-0 bg-gradient-to-b from-[#0d1525] to-[#0a0f1a] shadow-2xl shadow-black/60 max-h-[85vh] overflow-y-auto',
        'sm:rounded-2xl sm:border-b',
        'sm:static sm:inset-auto sm:mx-auto sm:max-h-[85vh] sm:max-w-lg',
        'p-4 pb-8 sm:p-6',
        'animate-up-from-bottom',
        className
      )}
      {...props}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-3 sm:right-4 top-3 sm:top-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.08] transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  )
)
DialogContent.displayName = 'DialogContent'

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-bold leading-none tracking-tight text-white', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-zinc-400', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(
      'sticky bottom-0 -mx-4 -mb-8 sm:-mx-6 sm:-mb-6 px-4 sm:px-6 py-4 bg-[#0a0f1a]/95 backdrop-blur-sm border-t border-white/[0.06]',
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2',
      '[&>button]:w-full [&>button]:sm:w-auto',
      className
    )} {...props} />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
