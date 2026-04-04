import { useState, useCallback, createContext, useContext, type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

interface ToastContextType {
  toast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    const duration = 4000
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 16)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose(toast.id), 300)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onClose])

  const icons = {
    default: <Info className="h-4 w-4 text-blue-400 shrink-0" />,
    destructive: <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
  }

  const barColors = {
    default: 'bg-blue-500',
    destructive: 'bg-red-500',
    success: 'bg-emerald-500',
  }

  return (
    <div
      className={cn(
        'rounded-xl border shadow-2xl transition-all duration-300 ease-out',
        visible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-4 scale-95',
        'border-white/[0.08] bg-[#0c1220] text-white overflow-hidden relative',
        toast.variant === 'destructive' && 'border-red-500/20 bg-red-500/5',
        toast.variant === 'success' && 'border-emerald-500/20 bg-emerald-500/5'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {icons[toast.variant ?? 'default']}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{toast.title}</p>
            {toast.description && <p className="text-xs text-zinc-400 mt-0.5">{toast.description}</p>}
          </div>
          <button
            onClick={() => {
              setVisible(false)
              setTimeout(() => onClose(toast.id), 300)
            }}
            className="opacity-40 hover:opacity-100 cursor-pointer transition-opacity shrink-0 text-zinc-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Dismiss progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
        <div
          className={cn('h-full transition-[width] duration-100 ease-linear', barColors[toast.variant ?? 'default'])}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...t, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
