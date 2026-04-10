import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, XCircle, Check, Truck, ShoppingCart, FileText, Search, Filter, TrendingUp, Download } from 'lucide-react'
import { exportToCSV, pedidoColumns } from '@/lib/export'
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils'
import type { Pedido, Produto, PedidoItem, Usuario, Cliente, EmpresaUsuario, Hierarquia } from '@/types/database'

interface PedidoItemForm {
  produto_id: string
  produto_nome: string
  quantidade: number
  preco_unitario: number
}

export default function Pedidos() {
  const { usuario } = useAuth()
  const { empresa, empresaUsuario } = useEmpresa()
  const { isMaster, isAdmin, isGerente, canManageProducts } = usePermissions()
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [subordinados, setSubordinados] = useState<EmpresaUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [pedidoItens, setPedidoItens] = useState<PedidoItem[]>([])

  const [itens, setItens] = useState<PedidoItemForm[]>([])
  const [formClienteId, setFormClienteId] = useState('')
  const [formVendedorId, setFormVendedorId] = useState('')
  const [formObs, setFormObs] = useState('')
  const [addProdutoId, setAddProdutoId] = useState('')
  const [addQtd, setAddQtd] = useState('1')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const canAssignToOther = isMaster || isAdmin || isGerente

  useEffect(() => {
    if (empresa) {
      fetchPedidos()
      fetchProdutos()
      fetchClientes()
      if (canAssignToOther) fetchSubordinados()
    }
  }, [empresa])

  async function fetchPedidos() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, usuario:usuarios(nome), cliente:clientes(nome)')
      .eq('empresa_id', empresa!.id)
      .order('created_at', { ascending: false })

    let result = data ?? []

    if (!isMaster && !isAdmin && empresaUsuario) {
      const { data: subs } = await supabase.rpc('get_subordinados', {
        p_empresa_usuario_id: empresaUsuario.id,
      })
      const subUserIds = new Set((subs ?? []).map((s: { id: string }) => s.id))
      result = result.filter(
        (p) => p.usuario_id === usuario?.id || subUserIds.has(p.usuario_id)
      )
    }

    setPedidos(result)
    setLoading(false)
  }

  async function fetchProdutos() {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('nome')

    setProdutos(data ?? [])
  }

  async function fetchClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('nome')

    setClientes(data ?? [])
  }

  async function fetchSubordinados() {
    if (!empresaUsuario) return

    const { data } = await supabase
      .from('empresa_usuarios')
      .select('*, usuario:usuarios(id, nome), hierarquias(nome, ordem)')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)

    if (data) {
      const meus = data.filter((eu) => {
        const h = eu.hierarquias as unknown as Hierarquia
        return h && hierarquiaOrdem !== null && h.ordem >= hierarquiaOrdem
      })
      setSubordinados(meus as unknown as EmpresaUsuario[])
    }
  }

  function openCreateDialog() {
    setItens([])
    setFormClienteId('')
    setFormVendedorId(usuario?.id ?? '')
    setFormObs('')
    setDialogOpen(true)
  }

  function addItem() {
    const prod = produtos.find((p) => p.id === addProdutoId)
    if (!prod) return
    const qtd = parseInt(addQtd) || 1
    const exists = itens.find((i) => i.produto_id === prod.id)
    if (exists) {
      setItens(itens.map((i) => i.produto_id === prod.id ? { ...i, quantidade: i.quantidade + qtd } : i))
    } else {
      setItens([...itens, { produto_id: prod.id, produto_nome: prod.nome, quantidade: qtd, preco_unitario: prod.preco_venda }])
    }
    setAddProdutoId('')
    setAddQtd('1')
  }

  function removeItem(produtoId: string) {
    setItens(itens.filter((i) => i.produto_id !== produtoId))
  }

  const valorTotal = itens.reduce((sum, i) => sum + i.quantidade * i.preco_unitario, 0)

  async function handleCreatePedido() {
    if (!empresa || !usuario || itens.length === 0) return

    const vendedorId = canAssignToOther && formVendedorId ? formVendedorId : usuario.id

    try {
      const { data: pedido, error: pError } = await supabase
        .from('pedidos')
        .insert({
          empresa_id: empresa.id,
          usuario_id: vendedorId,
          cliente_id: formClienteId || null,
          status: 'rascunho',
          valor_total: valorTotal,
          observacao: formObs || null,
        })
        .select()
        .single()

      if (pError) throw pError

      const { error: iError } = await supabase.from('pedido_itens').insert(
        itens.map((i) => ({
          pedido_id: pedido.id,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          subtotal: i.quantidade * i.preco_unitario,
        }))
      )

      if (iError) throw iError

      toast({ title: 'Pedido criado como rascunho', variant: 'success' })
      setDialogOpen(false)
      setItens([])
      setFormClienteId('')
      setFormVendedorId('')
      setFormObs('')
      fetchPedidos()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar pedido'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  }

  async function handleStatusChange(pedido: Pedido, newStatus: 'confirmado' | 'entregue' | 'cancelado') {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', pedido.id)

      if (error) throw error

      if (newStatus === 'confirmado') {
        const { data: items } = await supabase
          .from('pedido_itens')
          .select('*')
          .eq('pedido_id', pedido.id)

        for (const item of items ?? []) {
          const { error: movError } = await supabase.from('estoque_movimentacoes').insert({
            produto_id: item.produto_id,
            empresa_id: empresa!.id,
            tipo: 'saida',
            quantidade: item.quantidade,
            pedido_id: pedido.id,
            usuario_id: usuario!.id,
            observacao: 'Pedido confirmado',
          })
          if (movError) throw movError
        }
      } else if (newStatus === 'cancelado' && pedido.status === 'confirmado') {
        const { data: items } = await supabase
          .from('pedido_itens')
          .select('*')
          .eq('pedido_id', pedido.id)

        for (const item of items ?? []) {
          const { error: movError } = await supabase.from('estoque_movimentacoes').insert({
            produto_id: item.produto_id,
            empresa_id: empresa!.id,
            tipo: 'cancelamento',
            quantidade: item.quantidade,
            pedido_id: pedido.id,
            usuario_id: usuario!.id,
            observacao: 'Pedido cancelado - estoque revertido',
          })
          if (movError) throw movError
        }
      }

      toast({ title: `Pedido ${newStatus}`, variant: 'success' })
      fetchPedidos()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  }

  async function viewDetail(pedido: Pedido) {
    setSelectedPedido(pedido)
    const { data } = await supabase
      .from('pedido_itens')
      .select('*, produtos(nome, sku)')
      .eq('pedido_id', pedido.id)

    setPedidoItens(data ?? [])
    setDetailOpen(true)
  }

  const statusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' }> = {
    rascunho: { label: 'Rascunho', variant: 'secondary' },
    confirmado: { label: 'Confirmado', variant: 'default' },
    entregue: { label: 'Entregue', variant: 'success' },
    cancelado: { label: 'Cancelado', variant: 'destructive' },
  }

  function getStatusConfig(status: string) {
    return statusConfig[status] ?? { label: status, variant: 'secondary' as const }
  }

  function canCancel(pedido: Pedido) {
    if (pedido.status === 'cancelado' || pedido.status === 'entregue') return false
    if (pedido.usuario_id === usuario?.id) return true
    if (isMaster || isAdmin || isGerente) return true
    return false
  }

  const pedidosConfirmados = pedidos.filter(p => p.status === 'confirmado').length
  const pedidosRascunho = pedidos.filter(p => p.status === 'rascunho').length
  const valorTotalPedidos = pedidos.filter(p => p.status !== 'cancelado').reduce((sum, p) => sum + (p.valor_total || 0), 0)

  const filteredPedidos = pedidos.filter((p) => {
    const matchStatus = !statusFilter || p.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (p.usuario as unknown as Usuario)?.nome?.toLowerCase().includes(q) ||
      ((p.cliente as unknown as Cliente)?.nome ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 touch-manipulation">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Pedidos</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Gerenciamento de vendas e pedidos</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 self-start touch-manipulation">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Pedido</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 stagger-children">
        <Card className="border border-blue-500/10 bg-gradient-to-br from-blue-500/[0.06] to-transparent">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-blue-500/10 shrink-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-blue-300 truncate">{pedidos.length}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-amber-500/10 bg-gradient-to-br from-amber-500/[0.06] to-transparent">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 shrink-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-amber-300 truncate">{pedidosRascunho}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Rascunhos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-500/10 bg-gradient-to-br from-emerald-500/[0.06] to-transparent">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10 shrink-0">
              <Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-emerald-300 truncate">{pedidosConfirmados}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Confirmados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-violet-500/10 bg-gradient-to-br from-violet-500/[0.06] to-transparent">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-violet-500/10 shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-violet-300 truncate">{formatCurrency(valorTotalPedidos)}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Valor Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          <Input
            placeholder="Buscar por vendedor ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500 shrink-0 hidden sm:block" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[180px]"
          >
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="confirmado">Confirmado</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </Select>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredPedidos as unknown as Record<string, unknown>[], 'pedidos', pedidoColumns)} title="Exportar CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Order List */}
      <Card className="border-white/[0.06] bg-card/50">
        <CardContent className="pt-4 sm:pt-6">
          {loading ? (
            <div className="py-8 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        Data
                        <span className="text-[10px] font-normal normal-case tracking-normal block text-zinc-600">Relativo</span>
                      </TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>A&ccedil;&otilde;es</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos.map((p) => {
                      const sc = statusConfig[p.status]
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div>
                              <p className="text-zinc-300">{formatDate(p.created_at)}</p>
                              <p className="text-[10px] text-zinc-500">{formatRelativeDate(p.created_at)}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{(p.usuario as unknown as Usuario)?.nome ?? '—'}</TableCell>
                          <TableCell>{(p.cliente as unknown as Cliente)?.nome ?? <span className="text-zinc-600">—</span>}</TableCell>
                          <TableCell>
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-white">{formatCurrency(p.valor_total ?? 0)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => viewDetail(p)} title="Detalhes">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {p.status === 'rascunho' && (
                                <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p, 'confirmado')} title="Confirmar">
                                  <Check className="h-4 w-4 text-emerald-400" />
                                </Button>
                              )}
                              {p.status === 'confirmado' && (
                                <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p, 'entregue')} title="Marcar entregue">
                                  <Truck className="h-4 w-4 text-blue-400" />
                                </Button>
                              )}
                              {canCancel(p) && p.status !== 'cancelado' && p.status !== 'entregue' && (
                                <Button variant="ghost" size="icon" onClick={() => { if (confirm('Cancelar este pedido?')) handleStatusChange(p, 'cancelado') }} title="Cancelar">
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredPedidos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-14">
                            <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                              <ShoppingCart className="h-8 w-8 text-zinc-600" />
                            </div>
                            <p className="text-sm font-semibold text-zinc-400">{pedidos.length === 0 ? 'Nenhum pedido registrado' : 'Nenhum pedido encontrado'}</p>
                            <p className="text-xs text-zinc-600 mt-1.5">{pedidos.length === 0 ? 'Crie seu primeiro pedido para começar' : 'Tente ajustar seus filtros de busca'}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredPedidos.map((p, index) => {
                  const sc = getStatusConfig(p.status)
                  const statusColors: Record<string, string> = {
                    rascunho: 'from-zinc-500/10 to-transparent border-zinc-500/20',
                    confirmado: 'from-blue-500/10 to-transparent border-blue-500/20',
                    entregue: 'from-emerald-500/10 to-transparent border-emerald-500/20',
                    cancelado: 'from-red-500/10 to-transparent border-red-500/20',
                  }
                  const statusBadgeColors: Record<string, string> = {
                    rascunho: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20',
                    confirmado: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
                    entregue: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
                    cancelado: 'bg-red-500/15 text-red-300 border-red-500/20',
                  }
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border bg-gradient-to-br ${statusColors[p.status] ?? 'from-white/[0.03] to-transparent border-white/[0.06]'} p-3.5 animate-fade-in`}
                      style={{ animationDelay: `${index * 0.04}s` }}
                    >
                      {/* Top row: status badge + vendor */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white text-sm truncate">{(p.usuario as unknown as Usuario)?.nome ?? '—'}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">
                            {(p.cliente as unknown as Cliente)?.nome ?? 'Sem cliente'}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${statusBadgeColors[p.status] ?? 'bg-white/10 text-zinc-300 border-white/20'}`}
                        >
                          {sc.label}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-white/[0.05] mb-3" />

                      {/* Bottom row: value/date + actions */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{formatCurrency(p.valor_total ?? 0)}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{formatRelativeDate(p.created_at)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => viewDetail(p)}
                            className="h-10 w-10 rounded-lg bg-white/[0.04] border-white/[0.08] touch-manipulation"
                            title="Detalhes"
                          >
                            <Eye className="h-4 w-4 text-zinc-400" />
                          </Button>
                          {p.status === 'rascunho' && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleStatusChange(p, 'confirmado')}
                              className="h-10 w-10 rounded-lg bg-emerald-500/10 border-emerald-500/20 touch-manipulation"
                              title="Confirmar"
                            >
                              <Check className="h-4 w-4 text-emerald-400" />
                            </Button>
                          )}
                          {p.status === 'confirmado' && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleStatusChange(p, 'entregue')}
                              className="h-10 w-10 rounded-lg bg-blue-500/10 border-blue-500/20 touch-manipulation"
                              title="Entregue"
                            >
                              <Truck className="h-4 w-4 text-blue-400" />
                            </Button>
                          )}
                          {canCancel(p) && p.status !== 'cancelado' && p.status !== 'entregue' && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => { if (confirm('Cancelar este pedido?')) handleStatusChange(p, 'cancelado') }}
                              className="h-10 w-10 rounded-lg bg-red-500/10 border-red-500/20 touch-manipulation"
                              title="Cancelar"
                            >
                              <XCircle className="h-4 w-4 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Mobile empty state */}
                {filteredPedidos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-5">
                      <ShoppingCart className="h-10 w-10 text-zinc-600" />
                    </div>
                    <p className="text-base font-semibold text-zinc-300 text-center">
                      {pedidos.length === 0 ? 'Nenhum pedido registrado' : 'Nenhum pedido encontrado'}
                    </p>
                    <p className="text-sm text-zinc-500 mt-2 text-center">
                      {pedidos.length === 0
                        ? 'Crie seu primeiro pedido para começar'
                        : 'Tente ajustar seus filtros de busca'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-2xl p-4 sm:p-6 w-full sm:max-w-lg md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {canAssignToOther && (
              <div className="space-y-2">
                <Label>Vendedor respons&aacute;vel</Label>
                <Select value={formVendedorId} onChange={(e) => setFormVendedorId(e.target.value)}>
                  {subordinados.map((eu) => {
                    const u = eu.usuario as unknown as { id: string; nome: string }
                    const h = eu.hierarquias as unknown as Hierarquia
                    return (
                      <option key={eu.id} value={u?.id}>
                        {u?.nome} ({h?.nome})
                      </option>
                    )
                  })}
                </Select>
                <p className="text-[10px] text-zinc-500">Voc&ecirc; pode lan&ccedil;ar o pedido no nome de um subordinado</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={formClienteId} onChange={(e) => setFormClienteId(e.target.value)}>
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.cidade ? ` — ${c.cidade}` : ''}</option>
                ))}
              </Select>
            </div>

            {/* Product add section — mobile friendly */}
            <div className="space-y-3">
              <Label>Adicionar produto</Label>
              <Select value={addProdutoId} onChange={(e) => setAddProdutoId(e.target.value)} className="w-full">
                <option value="">Selecione um produto...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} — {formatCurrency(p.preco_venda)}</option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={addQtd}
                  onChange={(e) => setAddQtd(e.target.value)}
                  className="w-24"
                  placeholder="Qtd"
                />
                <Button onClick={addItem} disabled={!addProdutoId} className="flex-1 sm:flex-initial touch-manipulation">
                  <Plus className="h-4 w-4 sm:mr-0" />
                  <span className="sm:hidden">Adicionar</span>
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>
            </div>

            {/* Items table */}
            {itens.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-white/[0.02]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Pre&ccedil;o Un.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((i) => (
                      <TableRow key={i.produto_id}>
                        <TableCell className="font-semibold">{i.produto_nome}</TableCell>
                        <TableCell className="text-right">{i.quantidade}</TableCell>
                        <TableCell className="text-right text-zinc-400">{formatCurrency(i.preco_unitario)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(i.quantidade * i.preco_unitario)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i.produto_id)} className="touch-manipulation">
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-white/[0.02]">
                      <TableCell colSpan={3} className="text-right font-bold text-zinc-400">Total:</TableCell>
                      <TableCell className="text-right font-bold text-lg text-white">{formatCurrency(valorTotal)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observa&ccedil;&atilde;o (opcional)</Label>
              <Input value={formObs} onChange={(e) => setFormObs(e.target.value)} placeholder="Adicione uma observa&ccedil;&atilde;o..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="touch-manipulation">Cancelar</Button>
            <Button onClick={handleCreatePedido} disabled={itens.length === 0} className="touch-manipulation">Criar Pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent onClose={() => setDetailOpen(false)}>
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Status</p>
                  <Badge variant={statusConfig[selectedPedido.status].variant}>
                    {statusConfig[selectedPedido.status].label}
                  </Badge>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Data</p>
                  <p className="text-sm font-medium">{formatDate(selectedPedido.created_at)}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Valor Total</p>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(selectedPedido.valor_total)}</p>
                </div>
                {selectedPedido.observacao && (
                  <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Observa&ccedil;&atilde;o</p>
                    <p className="text-sm">{selectedPedido.observacao}</p>
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Pre&ccedil;o Un.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidoItens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold">{(item.produto as unknown as Produto)?.nome ?? '—'}</TableCell>
                      <TableCell className="text-right">{item.quantidade}</TableCell>
                      <TableCell className="text-right text-zinc-400">{formatCurrency(item.preco_unitario)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
