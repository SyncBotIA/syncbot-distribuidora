import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Truck, Search, CheckCircle, Clock, Package, Eye, Camera, ImageIcon, X, Upload } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Pedido, PedidoItem } from '@/types/database'

type EntregaPedido = Pedido & {
  usuario?: { nome: string }
  cliente?: { nome: string } | null
}

export default function Entregas() {
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<EntregaPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [selectedPedido, setSelectedPedido] = useState<EntregaPedido | null>(null)
  const [pedidoItens, setPedidoItens] = useState<PedidoItem[]>([])
  const [detailOpen, setDetailOpen] = useState(false)

  // Confirmação de entrega com comprovante
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmPedidoId, setConfirmPedidoId] = useState<string | null>(null)
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null)
  const [comprovantePreview, setComprovantePreview] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  useEffect(() => {
    if (empresa && usuario) {
      fetchEntregas()
    }
  }, [empresa, usuario])

  async function fetchEntregas() {
    setLoading(true)

    // Buscar pedidos da empresa que têm este usuário como entregador
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, usuario:usuarios(nome), cliente:clientes(nome), pedido_entregadores(usuario_id)')
      .eq('empresa_id', empresa!.id)
      .in('status', ['confirmado', 'entregue'])
      .order('created_at', { ascending: false })

    if (error) {
      toast({ title: 'Erro ao carregar entregas', description: error.message, variant: 'destructive' })
      setLoading(false)
      return
    }

    // Filtrar apenas pedidos onde este usuário é entregador
    const myPedidos = (data ?? []).filter((p) => {
      const entregadores = (p as unknown as { pedido_entregadores?: { usuario_id: string }[] }).pedido_entregadores
      return entregadores?.some((pe) => pe.usuario_id === usuario!.id)
    })

    setPedidos(myPedidos)
    setLoading(false)
  }

  function openConfirmDialog(pedidoId: string) {
    setConfirmPedidoId(pedidoId)
    setComprovanteFile(null)
    setComprovantePreview(null)
    setConfirmDialogOpen(true)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (JPG, PNG, etc.)', variant: 'destructive' })
      return
    }
    setComprovanteFile(file)
    setComprovantePreview(URL.createObjectURL(file))
  }

  function removeComprovante() {
    setComprovanteFile(null)
    if (comprovantePreview) URL.revokeObjectURL(comprovantePreview)
    setComprovantePreview(null)
  }

  async function handleConfirmarEntrega() {
    if (!confirmPedidoId) return
    setConfirmingId(confirmPedidoId)
    try {
      let comprovante_url: string | null = null

      // Upload da imagem se houver
      if (comprovanteFile) {
        const ext = comprovanteFile.name.split('.').pop() || 'jpg'
        const path = `comprovantes/${confirmPedidoId}_${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('entregas')
          .upload(path, comprovanteFile, { upsert: true })

        if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

        const { data: urlData } = supabase.storage.from('entregas').getPublicUrl(path)
        comprovante_url = urlData.publicUrl
      }

      // Atualizar status do pedido
      const { error } = await supabase
        .from('pedidos')
        .update({ status: 'entregue', updated_at: new Date().toISOString() })
        .eq('id', confirmPedidoId)

      if (error) throw new Error(error.message)

      // Salvar URL do comprovante separadamente (pode falhar se coluna não existe ainda)
      if (comprovante_url) {
        await supabase
          .from('pedidos')
          .update({ comprovante_url } as Record<string, unknown>)
          .eq('id', confirmPedidoId)
      }

      toast({ title: 'Entrega confirmada', variant: 'success' })
      setConfirmDialogOpen(false)
      setDetailOpen(false)
      fetchEntregas()
    } catch (err: unknown) {
      console.error('[Entregas] Erro ao confirmar:', JSON.stringify(err, null, 2), err)
      const e = err as { message?: string; error?: string; statusCode?: string }
      const message = e?.message || e?.error || JSON.stringify(err)
      toast({ title: 'Erro ao confirmar entrega', description: message, variant: 'destructive' })
    } finally {
      setConfirmingId(null)
    }
  }

  async function viewDetail(pedido: EntregaPedido) {
    setSelectedPedido(pedido)
    const { data } = await supabase
      .from('pedido_itens')
      .select('*, produtos(nome, sku)')
      .eq('pedido_id', pedido.id)

    setPedidoItens(data ?? [])
    setDetailOpen(true)
  }

  const hasActiveFilters = search || statusFilter || dataInicio || dataFim

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setDataInicio('')
    setDataFim('')
  }

  const filteredPedidos = pedidos.filter((p) => {
    // Status filter
    if (statusFilter === 'pendentes' && p.status !== 'confirmado') return false
    if (statusFilter === 'entregues' && p.status !== 'entregue') return false
    if (statusFilter === 'futuros') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const createdAt = new Date(p.created_at)
      if (createdAt < today) return false
    }

    // Date range filter
    if (dataInicio && p.created_at < dataInicio) return false
    if (dataFim && p.created_at > dataFim + 'T23:59:59') return false

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      const clienteNome = (p.cliente as unknown as { nome: string } | null)?.nome?.toLowerCase() ?? ''
      if (!clienteNome.includes(q)) return false
    }

    return true
  })

  // Stats
  const pendentes = pedidos.filter((p) => p.status === 'confirmado').length
  const entregues = pedidos.filter((p) => p.status === 'entregue').length
  const total = pedidos.length

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/20">
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Minhas Entregas</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Gerencie suas entregas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Card className="border border-amber-500/10 bg-gradient-to-br from-amber-500/[0.06] to-transparent">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-amber-600 truncate">{pendentes}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-500/10 bg-gradient-to-br from-emerald-500/[0.06] to-transparent">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10 shrink-0">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-emerald-600 truncate">{entregues}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Entregues</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-blue-500/10 bg-gradient-to-br from-blue-500/[0.06] to-transparent">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-blue-500/10 shrink-0">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-blue-600 truncate">{total}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[180px]"
          >
            <option value="">Todos</option>
            <option value="pendentes">Pendentes</option>
            <option value="entregues">Entregues</option>
            <option value="futuros">Futuros</option>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-zinc-500">Data Inicio</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-zinc-500">Data Fim</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="text-sm"
            />
          </div>
          {hasActiveFilters && (
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-xs whitespace-nowrap"
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-zinc-500">{filteredPedidos.length} entrega(s) encontrada(s)</p>

      {/* Data */}
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
                      <TableHead>Data</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Acao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos.map((p) => {
                      const vendedor = (p.usuario as unknown as { nome: string } | undefined)?.nome ?? '—'
                      const cliente = (p.cliente as unknown as { nome: string } | null)?.nome ?? '—'
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-zinc-300">{formatDate(p.created_at)}</TableCell>
                          <TableCell className="font-semibold">{vendedor}</TableCell>
                          <TableCell>{cliente}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === 'entregue' ? 'success' : 'default'}>
                              {p.status === 'entregue' ? 'Entregue' : 'Confirmado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-white">{formatCurrency(p.valor_total ?? 0)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-blue-400 hover:text-blue-300"
                                onClick={() => viewDetail(p)}
                              >
                                <Eye className="h-4 w-4" />
                                <span>Ver</span>
                              </Button>
                              {p.status === 'confirmado' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-emerald-400 hover:text-emerald-300"
                                  onClick={() => openConfirmDialog(p.id)}
                                  disabled={confirmingId === p.id}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>{confirmingId === p.id ? 'Confirmando...' : 'Confirmar'}</span>
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
                              <Truck className="h-8 w-8 text-zinc-600" />
                            </div>
                            <p className="text-sm font-semibold text-zinc-400">
                              {pedidos.length === 0 ? 'Nenhuma entrega encontrada' : 'Nenhuma entrega corresponde aos filtros'}
                            </p>
                            <p className="text-xs text-zinc-600 mt-1.5">
                              {pedidos.length === 0 ? 'Suas entregas aparecerão aqui' : 'Tente ajustar seus filtros de busca'}
                            </p>
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
                  const vendedor = (p.usuario as unknown as { nome: string } | undefined)?.nome ?? '—'
                  const cliente = (p.cliente as unknown as { nome: string } | null)?.nome ?? 'Sem cliente'
                  const statusColors: Record<string, string> = {
                    confirmado: 'from-blue-500/10 to-transparent border-blue-500/20',
                    entregue: 'from-emerald-500/10 to-transparent border-emerald-500/20',
                  }
                  const statusBadgeColors: Record<string, string> = {
                    confirmado: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
                    entregue: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
                  }
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border bg-gradient-to-br ${statusColors[p.status] ?? 'from-white/[0.03] to-transparent border-white/[0.06]'} p-3.5 animate-fade-in`}
                      style={{ animationDelay: `${index * 0.04}s` }}
                    >
                      {/* Top row: client + status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white text-sm truncate">{cliente}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">Vendedor: {vendedor}</p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${statusBadgeColors[p.status] ?? 'bg-white/10 text-zinc-300 border-white/20'}`}
                        >
                          {p.status === 'entregue' ? 'Entregue' : 'Confirmado'}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-white/[0.05] mb-3" />

                      {/* Bottom row: value/date + action */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{formatCurrency(p.valor_total ?? 0)}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{formatDate(p.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDetail(p)}
                            className="gap-1.5 bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 touch-manipulation"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Ver</span>
                          </Button>
                        {p.status === 'confirmado' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openConfirmDialog(p.id)}
                            disabled={confirmingId === p.id}
                            className="gap-1.5 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 touch-manipulation"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>{confirmingId === p.id ? 'Confirmando...' : 'Confirmar'}</span>
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
                      <Truck className="h-10 w-10 text-zinc-600" />
                    </div>
                    <p className="text-base font-semibold text-zinc-300 text-center">
                      {pedidos.length === 0 ? 'Nenhuma entrega encontrada' : 'Nenhuma entrega corresponde aos filtros'}
                    </p>
                    <p className="text-sm text-zinc-500 mt-2 text-center">
                      {pedidos.length === 0
                        ? 'Suas entregas aparecerão aqui'
                        : 'Tente ajustar seus filtros de busca'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhes do pedido */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent onClose={() => setDetailOpen(false)}>
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Status</p>
                  <Badge variant={selectedPedido.status === 'entregue' ? 'success' : 'default'}>
                    {selectedPedido.status === 'entregue' ? 'Entregue' : 'Confirmado'}
                  </Badge>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Data</p>
                  <p className="text-sm font-medium">{formatDate(selectedPedido.created_at)}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Cliente</p>
                  <p className="text-sm font-medium">{(selectedPedido.cliente as unknown as { nome: string } | null)?.nome ?? '—'}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Valor Total</p>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(selectedPedido.valor_total)}</p>
                </div>
              </div>
              {selectedPedido.observacao && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Observação</p>
                  <p className="text-sm">{selectedPedido.observacao}</p>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidoItens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{(item as unknown as { produtos?: { nome: string } }).produtos?.nome ?? '—'}</TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-right text-zinc-400">{formatCurrency(item.preco_unitario)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Comprovante de entrega */}
              {selectedPedido.comprovante_url && (
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Comprovante de Entrega</p>
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <img
                      src={selectedPedido.comprovante_url}
                      alt="Comprovante de entrega"
                      className="w-full max-h-[300px] object-contain bg-black/20 cursor-pointer"
                      onClick={() => window.open(selectedPedido.comprovante_url!, '_blank')}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center">Clique na imagem para ampliar</p>
                </div>
              )}

              {selectedPedido.status === 'confirmado' && (
                <Button
                  onClick={() => { setDetailOpen(false); openConfirmDialog(selectedPedido.id) }}
                  disabled={confirmingId === selectedPedido.id}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 touch-manipulation"
                >
                  <CheckCircle className="h-4 w-4" />
                  {confirmingId === selectedPedido.id ? 'Confirmando...' : 'Confirmar Entrega'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação com upload de comprovante */}
      <Dialog open={confirmDialogOpen} onOpenChange={(open) => { if (!open) { removeComprovante(); setConfirmDialogOpen(false) } }}>
        <DialogContent onClose={() => { removeComprovante(); setConfirmDialogOpen(false) }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-400" />
              Confirmar Entrega
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Anexe uma foto da nota assinada pelo cliente para confirmar a entrega.
            </p>

            {/* Upload area */}
            {!comprovantePreview ? (
              <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] cursor-pointer hover:border-blue-500/30 hover:bg-white/[0.04] transition-all touch-manipulation">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Upload className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-300">Toque para selecionar a foto</p>
                  <p className="text-xs text-zinc-500 mt-1">JPG, PNG ou HEIC</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative rounded-xl border border-white/[0.06] overflow-hidden">
                <img
                  src={comprovantePreview}
                  alt="Preview do comprovante"
                  className="w-full max-h-[250px] object-contain bg-black/20"
                />
                <button
                  onClick={removeComprovante}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  <ImageIcon className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-300">Foto anexada</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { removeComprovante(); setConfirmDialogOpen(false) }}
                className="flex-1 touch-manipulation"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarEntrega}
                disabled={confirmingId !== null}
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 touch-manipulation"
              >
                <CheckCircle className="h-4 w-4" />
                {confirmingId ? 'Enviando...' : 'Confirmar Entrega'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
