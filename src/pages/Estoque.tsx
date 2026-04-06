import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Plus, AlertTriangle, Search, Warehouse, PackageCheck, PackageMinus,
  Package, ArrowUpRight, ArrowDownLeft, SlidersHorizontal, History,
  Barcode, TrendingDown, ArrowRightLeft
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Produto, EstoqueMovimentacao, Usuario } from '@/types/database'

/** Supabase joins return nested data under "produtos" and "usuarios" keys */
type MovimentacaoJoinRow = EstoqueMovimentacao & {
  produto?: Produto
  usuarios?: { nome: string }
}

export default function Estoque() {
  const { usuario } = useAuth()
  const { empresa, canManageStock } = useEmpresa()
  const { toast } = useToast()
  const [produtos, setProdutos] = useState<(Produto & { estoque_atual: number })[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoJoinRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState<'estoque' | 'historico'>('estoque')
  const [search, setSearch] = useState('')

  const [formProdutoId, setFormProdutoId] = useState('')
  const [formTipo, setFormTipo] = useState<'entrada' | 'saida' | 'ajuste'>('entrada')
  const [formQuantidade, setFormQuantidade] = useState('')
  const [formObs, setFormObs] = useState('')

  useEffect(() => {
    if (empresa) {
      fetchEstoque()
      fetchMovimentacoes()
    }
  }, [empresa])

  async function fetchEstoque() {
    const { data: prods } = await supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('nome')

    if (!prods) { setLoading(false); return }

    // Usa RPC get_estoque_atual do banco ao inves de N+1 manual
    const resultados = await Promise.all(
      prods.map(async (p) => {
        const { data } = await supabase.rpc('get_estoque_atual', { p_produto_id: p.id })
        return { ...p, estoque_atual: data ?? 0 }
      })
    )

    setProdutos(resultados)
    setLoading(false)
  }

  async function fetchMovimentacoes() {
    const { data } = await supabase
      .from('estoque_movimentacoes')
      .select('*, produtos(nome, sku), usuarios(nome)')
      .eq('empresa_id', empresa!.id)
      .order('created_at', { ascending: false })
      .limit(100)

    setMovimentacoes(data ?? [])
  }

  async function handleMovimentacao() {
    if (!empresa || !usuario) return

    const { error } = await supabase.from('estoque_movimentacoes').insert({
      produto_id: formProdutoId,
      empresa_id: empresa.id,
      tipo: formTipo,
      quantidade: parseInt(formQuantidade),
      usuario_id: usuario.id,
      observacao: formObs || null,
    })

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      return
    }

    toast({ title: 'Movimentação registrada', variant: 'success' })
    setDialogOpen(false)
    fetchEstoque()
    fetchMovimentacoes()
  }

  const filteredProdutos = produtos.filter((p) => {
    const q = search.toLowerCase()
    return p.nome.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
  })

  const tipoLabel: Record<string, string> = {
    entrada: 'Entrada',
    saida: 'Saída',
    ajuste: 'Ajuste',
    cancelamento: 'Cancelamento',
  }

  const tipoVariant: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    entrada: 'success',
    saida: 'destructive',
    ajuste: 'warning',
    cancelamento: 'secondary',
  }

  const totalEstoque = produtos.reduce((sum, p) => sum + p.estoque_atual, 0)
  const produtosBaixo = produtos.filter(p => p.estoque_atual <= p.estoque_minimo).length
  const produtosOk = produtos.filter(p => p.estoque_atual > p.estoque_minimo).length

  function getStockPercentage(atual: number, minimo: number): number {
    if (minimo === 0) return 100
    return Math.min((atual / (minimo * 3)) * 100, 100)
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/20">
            <Warehouse className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Estoque</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Controle de estoque e movimentações</p>
          </div>
        </div>
        {canManageStock && (
          <Button
            onClick={() => { setDialogOpen(true); setFormProdutoId(''); setFormTipo('entrada'); setFormQuantidade(''); setFormObs('') }}
            className="gap-2 self-start touch-manipulation"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Movimentação</span>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-blue-500/10 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-4 flex items-center gap-3 relative">
            <div className="p-2.5 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/10">
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-blue-300">{totalEstoque}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Itens em Estoque</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/10 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-4 flex items-center gap-3 relative">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/10">
              <PackageCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-300">{produtosOk}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Estoque Normal</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/10 overflow-hidden relative group hidden sm:block">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-4 flex items-center gap-3 relative">
            <div className="p-2.5 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 shadow-lg shadow-red-500/10">
              <PackageMinus className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{produtosBaixo}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Estoque Baixo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-full sm:w-fit">
        <button
          onClick={() => setTab('estoque')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer touch-manipulation ${
            tab === 'estoque'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-blue-500/30'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Estoque</span>
        </button>
        <button
          onClick={() => setTab('historico')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer touch-manipulation ${
            tab === 'historico'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-blue-500/30'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Histórico</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm mx-auto sm:mx-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Buscar produto ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {tab === 'estoque' ? (
        <Card>
          <CardContent className="pt-6">
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
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Estoque Atual</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProdutos.map((p) => {
                        const baixo = p.estoque_atual <= p.estoque_minimo
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-semibold">{p.nome}</TableCell>
                            <TableCell className="font-mono text-xs text-zinc-400">{p.sku}</TableCell>
                            <TableCell className={`text-right font-bold ${baixo ? 'text-red-400' : 'text-white'}`}>{p.estoque_atual}</TableCell>
                            <TableCell className="text-right text-zinc-500">{p.estoque_minimo}</TableCell>
                            <TableCell>
                              {baixo ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Baixo
                                </Badge>
                              ) : (
                                <Badge variant="success">Normal</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {filteredProdutos.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <div className="flex flex-col items-center justify-center py-14">
                              <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                                <Warehouse className="h-7 w-7 text-zinc-600" />
                              </div>
                              <p className="text-sm font-semibold text-zinc-400">Nenhum produto encontrado</p>
                              <p className="text-xs text-zinc-600 mt-1">{search ? 'Tente ajustar sua busca' : 'Nenhum produto cadastrado'}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2.5">
                  {filteredProdutos.map((p) => {
                    const baixo = p.estoque_atual <= p.estoque_minimo
                    const percentage = getStockPercentage(p.estoque_atual, p.estoque_minimo)
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5 active:scale-[0.98] transition-transform duration-150"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white text-sm leading-snug truncate">{p.nome}</p>
                            {p.sku && (
                              <p className="text-[11px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                                <Barcode className="h-3 w-3" />
                                {p.sku}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${
                              baixo
                                ? 'bg-red-500/10 text-red-400 ring-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                            }`}
                          >
                            {baixo ? (
                              <>
                                <AlertTriangle className="h-3 w-3" />
                                Baixo
                              </>
                            ) : (
                              <>
                                <PackageCheck className="h-3 w-3" />
                                OK
                              </>
                            )}
                          </span>
                        </div>

                        {/* Stock quantity - big and prominent */}
                        <div className="flex items-end gap-3 mb-2.5">
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-0.5">Estoque</p>
                            <p className={`text-2xl font-black tabular-nums ${baixo ? 'text-red-400' : 'text-white'}`}>
                              {p.estoque_atual}
                            </p>
                          </div>
                          <div className="pb-1">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-0.5">Mín.</p>
                            <p className="text-sm font-bold text-zinc-500">{p.estoque_minimo}</p>
                          </div>
                        </div>

                        {/* Stock level bar */}
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              baixo
                                ? 'bg-gradient-to-r from-red-500 to-red-400'
                                : percentage > 66
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-400'
                                  : 'bg-gradient-to-r from-amber-500 to-amber-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {filteredProdutos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-14">
                      <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                        <Warehouse className="h-7 w-7 text-zinc-600" />
                      </div>
                      <p className="text-sm font-semibold text-zinc-400">Nenhum produto encontrado</p>
                      <p className="text-xs text-zinc-600 mt-1">{search ? 'Tente ajustar sua busca' : 'Nenhum produto cadastrado'}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-zinc-500" />
              Histórico de Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-zinc-400">{formatDate(m.created_at)}</TableCell>
                      <TableCell className="font-semibold">{(m.produto as Produto | undefined)?.nome ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={tipoVariant[m.tipo]}>{tipoLabel[m.tipo]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{m.quantidade}</TableCell>
                      <TableCell>{m.usuarios?.nome ?? '—'}</TableCell>
                      <TableCell className="text-zinc-500 max-w-[200px] truncate">{m.observacao ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {movimentacoes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-14">
                          <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                            <Warehouse className="h-7 w-7 text-zinc-600" />
                          </div>
                          <p className="text-sm font-semibold text-zinc-400">Nenhuma movimentação registrada</p>
                          <p className="text-xs text-zinc-600 mt-1">Registre sua primeira movimentação de estoque</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2.5">
              {movimentacoes.map((m) => {
                const tipoIcon = m.tipo === 'entrada' ? ArrowUpRight : m.tipo === 'saida' ? ArrowDownLeft : SlidersHorizontal
                const tipoColor = m.tipo === 'entrada'
                  ? 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20'
                  : m.tipo === 'saida'
                    ? 'text-red-400 bg-red-500/10 ring-red-500/20'
                    : 'text-amber-400 bg-amber-500/10 ring-amber-500/20'
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-3.5 active:scale-[0.98] transition-transform duration-150"
                  >
                    <div className="flex items-start gap-3">
                      {/* Type indicator circle */}
                      <div className={`shrink-0 mt-0.5 p-2 rounded-xl ring-1 ${tipoColor}`}>
                        {tipoIcon({ className: 'h-4 w-4' })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-white text-sm leading-snug truncate">
                            {(m.produto as Produto | undefined)?.nome ?? '—'}
                          </p>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${tipoColor}`}>
                            {tipoLabel[m.tipo]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Qtd</span>
                            <span className={`text-lg font-black tabular-nums ${
                              m.tipo === 'entrada' ? 'text-emerald-400' : m.tipo === 'saida' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {m.tipo === 'saida' ? '-' : m.tipo === 'entrada' ? '+' : ''}{m.quantidade}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600">{formatDate(m.created_at)}</p>
                        </div>
                        {m.usuarios?.nome && (
                          <p className="text-[11px] text-zinc-500 mt-1">
                            por {m.usuarios.nome}
                          </p>
                        )}
                        {m.observacao && (
                          <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 italic">
                            "{m.observacao}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {movimentacoes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14">
                  <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                    <Warehouse className="h-7 w-7 text-zinc-600" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-400">Nenhuma movimentação registrada</p>
                  <p className="text-xs text-zinc-600 mt-1">Registre sua primeira movimentação de estoque</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-400" />
              Nova Movimentação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={formProdutoId} onChange={(e) => setFormProdutoId(e.target.value)}>
                <option value="">Selecione...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} ({p.sku})</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formTipo} onChange={(e) => setFormTipo(e.target.value as 'entrada' | 'saida' | 'ajuste')}>
                <option value="">Selecione o tipo...</option>
                <option value="entrada">Entrada (adicionar ao estoque)</option>
                <option value="saida">Saída (retirar do estoque)</option>
                <option value="ajuste">Ajuste (definir quantidade total)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min="0" value={formQuantidade} onChange={(e) => setFormQuantidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Input value={formObs} onChange={(e) => setFormObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleMovimentacao} disabled={!formProdutoId || !formQuantidade || !formTipo}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
