import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'

export interface AppNotification {
  id: string
  type: 'estoque_baixo' | 'pedido_rascunho'
  title: string
  message: string
  read: boolean
  created_at: string
  link?: string
}

const STORAGE_KEY = 'distribuidora_notif_read'

function getReadIds(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch { return new Set() }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function useNotifications() {
  const { empresa } = useEmpresa()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!empresa) return
    const readIds = getReadIds()
    const notifs: AppNotification[] = []

    // Estoque baixo
    const { data: produtos } = await supabase
      .from('produtos')
      .select('id, nome, estoque_atual, estoque_minimo')
      .eq('empresa_id', empresa.id)
      .eq('ativo', true)

    for (const p of produtos ?? []) {
      if (p.estoque_atual != null && p.estoque_minimo != null && p.estoque_atual <= p.estoque_minimo) {
        const id = `estoque_${p.id}`
        notifs.push({
          id, type: 'estoque_baixo', title: 'Estoque baixo',
          message: `${p.nome}: ${p.estoque_atual}/${p.estoque_minimo} un`,
          read: readIds.has(id), created_at: new Date().toISOString(), link: '/estoque',
        })
      }
    }

    // Pedidos rascunho
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, created_at')
      .eq('empresa_id', empresa.id)
      .eq('status', 'rascunho')
      .order('created_at', { ascending: false })

    for (const p of pedidos ?? []) {
      const id = `pedido_${p.id}`
      notifs.push({
        id, type: 'pedido_rascunho', title: 'Pedido pendente',
        message: `Pedido #${p.id.slice(0, 8)} aguardando confirmacao`,
        read: readIds.has(id), created_at: p.created_at, link: '/pedidos',
      })
    }

    setNotifications(notifs)
    setLoading(false)
  }, [empresa])

  useEffect(() => {
    fetchNotifications()
    if (!empresa) return

    const channel = supabase
      .channel('notif-realtime')
      // Pedidos: INSERT (novo pedido), UPDATE (mudança de status), DELETE
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresa.id}` }, () => fetchNotifications())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresa.id}` }, () => fetchNotifications())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresa.id}` }, () => fetchNotifications())
      // Estoque: movimentações afetam estoque baixo
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'estoque_movimentacoes', filter: `empresa_id=eq.${empresa.id}` }, () => fetchNotifications())
      // Produtos: alteração de estoque_minimo ou ativo
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'produtos', filter: `empresa_id=eq.${empresa.id}` }, () => fetchNotifications())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [empresa, fetchNotifications])

  const unreadCount = notifications.filter(n => !n.read).length

  function markAsRead(id: string) {
    const r = getReadIds(); r.add(id); saveReadIds(r)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllAsRead() {
    const r = getReadIds(); notifications.forEach(n => r.add(n.id)); saveReadIds(r)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: fetchNotifications }
}
