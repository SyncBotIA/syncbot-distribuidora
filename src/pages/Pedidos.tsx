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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, XCircle, Check, Truck, ShoppingCart, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Pedido, Produto, PedidoItem, Usuario, Cliente, EmpresaUsuario, Hierarquia } from '@/types/database'

interface PedidoItemForm {
  produto_id: string
  produto_nome: string
  quantidade: number
  preco_unitario: number
}

export default function Pedidos() {
  const { usuario } = useAuth()
  const { empresa, empresaUsuario, hierarquiaOrdem, isAdmin } = useEmpresa()
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

  const canAssignToOther = hierarquiaOrdem !== null && hierarquiaOrdem <= 2

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
      .select('*, usuarios(nome), clientes(nome)')
      .eq('empresa_id', empresa!.id)
      .order('created_at', { ascending: false })

    let result = data ?? []

    if (!isAdmin && empresaUsuario) {
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
      .select('*, usuarios(id, nome), hierarquias(nome, ordem)')
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
    const exists = itens.find((i) => i.produto_id === prod.id)
    if (exists) {
      setItens(itens.map((i) => i.produto_id === prod.id ? { ...i, quantidade: i.quantidade + parseInt(addQtd) } : i))
    } else {
      setItens([...itens, { produto_id: prod.id, produto_nome: prod.nome, quantidade: parseInt(addQtd) || 1, preco_unitario: prod.preco_venda }])
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
          await supabase.from('estoque_movimentacoes').insert({
            produto_id: item.produto_id,
            empresa_id: empresa!.id,
            tipo: 'saida',
            quantidade: item.quantidade,
            pedido_id: pedido.id,
            usuario_id: usuario!.id,
            observacao: 'Pedido confirmado',
          })
        }
      } else if (newStatus === 'cancelado' && pedido.status === 'confirmado') {
        const { data: items } = await supabase
          .from('pedido_itens')
          .select('*')
          .eq('pedido_id', pedido.id)

        for (const item of items ?? []) {
          await supabase.from('estoque_movimentacoes').insert({
            produto_id: item.produto_id,
            empresa_id: empresa!.id,
            tipo: 'cancelamento',
            quantidade: item.quantidade,
            pedido_id: pedido.id,
            usuario_id: usuario!.id,
            observacao: 'Pedido cancelado - estoque revertido',
          })
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

  function canCancel(pedido: Pedido) {
    if (pedido.status === 'cancelado' || pedido.status === 'entregue') return false
    if (pedido.usuario_id === usuario?.id) return true
    if (hierarquiaOrdem !== null && hierarquiaOrdem <= 2) return true
    return false
  }

  const pedidosConfirmados = pedidos.filter(p => p.status === 'confirmado').length
  const pedidosRascunho = pedidos.filter(p => p.status === 'rascunho').length
  const valorTotalPedidos = pedidos.filter(p => p.status !== 'cancelado').reduce((sum, p) => sum + (p.valor_total || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Pedidos</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Gerenciamento de vendas e pedidos</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Pedido</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <Card className="border-blue-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-blue-300">{pedidos.length}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <FileText className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-amber-300">{pedidosRascunho}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Rascunhos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-300">{pedidosConfirmados}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Confirmados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-violet-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <ShoppingCart className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-violet-300">{formatCurrency(valorTotalPedidos)}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Valor Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm text-zinc-500 font-medium">Carregando pedidos...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => {
                  const sc = statusConfig[p.status]
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-zinc-400">{formatDate(p.created_at)}</TableCell>
                      <TableCell className="font-semibold">{(p.usuario as unknown as Usuario)?.nome ?? '—'}</TableCell>
                      <TableCell>{(p.clientes as unknown as Cliente)?.nome ?? (p.cliente as unknown as Cliente)?.nome ?? <span className="text-zinc-600">—</span>}</TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-white">{formatCurrency(p.valor_total)}</TableCell>
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
                            <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p, 'cancelado')} title="Cancelar">
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {pedidos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-14">
                        <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                          <ShoppingCart className="h-7 w-7 text-zinc-600" />
                        </div>
                        <p className="text-sm font-semibold text-zinc-400">Nenhum pedido registrado</p>
                        <p className="text-xs text-zinc-600 mt-1">Crie seu primeiro pedido</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {canAssignToOther && (
              <div className="space-y-2">
                <Label>Vendedor responsavel</Label>
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
                <p className="text-[10px] text-zinc-500">Voce pode lancar o pedido no nome de um subordinado</p>
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

            <div className="flex gap-2">
              <Select value={addProdutoId} onChange={(e) => setAddProdutoId(e.target.value)} className="flex-1">
                <option value="">Selecione um produto...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} — {formatCurrency(p.preco_venda)}</option>
                ))}
              </Select>
              <Input type="number" min="1" value={addQtd} onChange={(e) => setAddQtd(e.target.value)} className="w-20" placeholder="Qtd" />
              <Button onClick={addItem} disabled={!addProdutoId}>Adicionar</Button>
            </div>

            {itens.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preco Un.</TableHead>
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
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i.produto_id)}>
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
              <Label>Observacao (opcional)</Label>
              <Input value={formObs} onChange={(e) => setFormObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePedido} disabled={itens.length === 0}>Criar Pedido</Button>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Status</p>
                  <Badge variant={statusConfig[selectedPedido.status].variant}>
                    {statusConfig[selectedPedido.status].label}
                  </Badge>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Data</p>
                  <p className="text-sm font-medium">{formatDate(selectedPedido.created_at)}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Valor Total</p>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(selectedPedido.valor_total)}</p>
                </div>
                {selectedPedido.observacao && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Observacao</p>
                    <p className="text-sm">{selectedPedido.observacao}</p>
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preco Un.</TableHead>
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
