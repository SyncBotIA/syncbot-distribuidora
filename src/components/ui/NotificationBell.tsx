import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertTriangle, ShoppingCart, CheckCheck } from 'lucide-react'
import { useNotifications, type AppNotification } from '@/hooks/useNotifications'

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'estoque_baixo') return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
  return <ShoppingCart className="h-4 w-4 text-blue-400 shrink-0" />
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleClick(n: AppNotification) {
    markAsRead(n.id)
    if (n.link) navigate(n.link)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[var(--theme-subtle-bg)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--theme-subtle-border)] bg-[var(--theme-dropdown-bg)] shadow-2xl shadow-black/20 z-50 flex flex-col max-h-96">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-subtle-border)] shrink-0">
            <span className="text-sm font-semibold text-foreground">Notificações ({notifications.length})</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar lidas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-[var(--theme-subtle-border)]">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--theme-subtle-bg)] transition-colors min-h-[44px] ${
                    !n.read ? 'bg-blue-500/[0.04]' : ''
                  }`}
                >
                  <div className="mt-0.5">
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!n.read ? 'font-semibold text-foreground' : 'text-secondary-foreground'}`}>
                        {n.title}
                      </span>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-1">{timeAgo(n.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
