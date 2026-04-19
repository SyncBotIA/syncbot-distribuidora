import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Travar scroll do body quando o dialog está aberto
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      {/* Mobile: fullscreen | Desktop: centralizado */}
      <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4">
        {children}
      </div>
    </div>,
    document.body
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }>(
  ({ className, children, onClose, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Mobile: fullscreen com scroll e cantos arredondados no topo
        'relative z-50 w-full flex-1 rounded-t-2xl bg-gradient-to-b from-[var(--theme-dialog-from)] to-[var(--theme-dialog-to)] shadow-2xl shadow-black/40 overflow-y-auto overscroll-contain',
        'border-[var(--theme-subtle-border)]',
        // Desktop: dialog centralizado
        'sm:flex-none sm:rounded-2xl sm:max-w-lg sm:max-h-[90vh] sm:border',
        'p-4 sm:p-6',
        className
      )}
      {...props}
    >
      {/* Indicador de arrastar — visível apenas no mobile */}
      <div className="sm:hidden w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-3" />
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-3 sm:right-4 top-3 sm:top-4 z-10 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--theme-subtle-bg-hover)] transition-all cursor-pointer"
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
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4 text-foreground', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-bold leading-none tracking-tight text-foreground', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

/**
 * DialogFooter: rodape normal (nao-sticky) com separador visual.
 * Como DialogContent tem padding simetrico e rola tudo junto, evita-se o bug
 * de o footer sticky com backdrop-blur sobrepor inputs da ultima linha.
 */
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(
      'mt-6 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-4 border-t border-[var(--theme-subtle-border)] bg-[var(--theme-dialog-footer-bg)]',
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2',
      '[&>button]:w-full [&>button]:sm:w-auto',
      className
    )} {...props} />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
