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
import { Plus, Eye, XCircle, Check, Truck } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Pedido, Produto, PedidoItem, Usuario, Cliente } from '@/types/database'

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
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [pedidoItens, setPedidoItens] = useState<PedidoItem[]>([])

  // Form
  const [itens, setItens] = useState<PedidoItemForm[]>([])
  const [formClienteId, setFormClienteId] = useState('')
  const [formObs, setFormObs] = useState('')
  const [addProdutoId, setAddProdutoId] = useState('')
  const [addQtd, setAddQtd] = useState('1')

  useEffect(() => {
    if (empresa) {
      fetchPedidos()
      fetchProdutos()
      fetchClientes()
    }
  }, [empresa])

  async function fetchPedidos() {
    let query = supabase
      .from('pedidos')
      .select('*, usuarios(nome), clientes(nome)')
      .eq('empresa_id', empresa!.id)
      .order('created_at', { ascending: false })

    const { data } = await query

    let result = data ?? []

    // Filter by subordinate tree if not admin
    if (!isAdmin && empresaUsuario) {
      const { data: subs } = await supabase.rpc('get_subordinados', {
        p_empresa_usuario_id: empresaUsuario.id,
      })
      const subUserIds = new Set((subs ?? []).map((s: { id: string }) => s.id))
      // Also include own pedidos
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

    try {
      // Create pedido
      const { data: pedido, error: pError } = await supabase
        .from('pedidos')
        .insert({
          empresa_id: empresa.id,
          usuario_id: usuario.id,
          cliente_id: formClienteId || null,
          status: 'rascunho',
          valor_total: valorTotal,
          observacao: formObs || null,
        })
        .select()
        .single()

      if (pError) throw pError

      // Create items
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

      // Handle stock changes
      if (newStatus === 'confirmado') {
        // Fetch items and deduct stock
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
            observacao: `Pedido confirmado`,
          })
        }
      } else if (newStatus === 'cancelado' && pedido.status === 'confirmado') {
        // Revert stock
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
            observacao: `Pedido cancelado - estoque revertido`,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Button onClick={() => { setDialogOpen(true); setItens([]); setFormClienteId(''); setFormObs('') }} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Pedido
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => {
                  const sc = statusConfig[p.status]
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.created_at)}</TableCell>
                      <TableCell>{(p.usuario as unknown as Usuario)?.nome ?? '—'}</TableCell>
                      <TableCell>{(p.clientes as unknown as Cliente)?.nome ?? (p.cliente as unknown as Cliente)?.nome ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(p.valor_total)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => viewDetail(p)} title="Detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {p.status === 'rascunho' && (
                            <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p, 'confirmado')} title="Confirmar">
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {p.status === 'confirmado' && (
                            <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p, 'entregue')} title="Marcar entregue">
                              <Truck className="h-4 w-4 text-blue-600" />
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum pedido</TableCell>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço Un.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.produto_id}>
                      <TableCell>{i.produto_nome}</TableCell>
                      <TableCell className="text-right">{i.quantidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(i.preco_unitario)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(i.quantidade * i.preco_unitario)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i.produto_id)}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Total:</TableCell>
                    <TableCell className="text-right font-bold text-lg">{formatCurrency(valorTotal)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={statusConfig[selectedPedido.status].variant}>
                    {statusConfig[selectedPedido.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p>{formatDate(selectedPedido.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Total</p>
                  <p className="font-bold">{formatCurrency(selectedPedido.valor_total)}</p>
                </div>
                {selectedPedido.observacao && (
                  <div>
                    <p className="text-muted-foreground">Observação</p>
                    <p>{selectedPedido.observacao}</p>
                  </div>
                )}
              </div>
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
                      <TableCell>{(item.produto as unknown as Produto)?.nome ?? '—'}</TableCell>
                      <TableCell className="text-right">{item.quantidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.preco_unitario)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
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
