import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Search, Trash2, Tags, Package, BarChart3, ArrowUpRight, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Produto, Categoria } from '@/types/database'

export default function Produtos() {
  const { empresa, canManageProducts } = useEmpresa()
  const { toast } = useToast()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [newCatNome, setNewCatNome] = useState('')

  const [form, setForm] = useState({
    nome: '', sku: '', descricao: '', categoria_id: '', unidade_medida: 'un',
    preco_custo: '', preco_venda: '', estoque_minimo: '0',
  })

  useEffect(() => {
    if (empresa) {
      fetchProdutos()
      fetchCategorias()
    }
  }, [empresa])

  async function fetchProdutos() {
    const { data } = await supabase
      .from('produtos')
      .select('*, categoria:categorias(*)')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('nome')

    setProdutos(data ?? [])
    setLoading(false)
  }

  async function fetchCategorias() {
    const { data } = await supabase
      .from('categorias')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .order('nome')

    setCategorias(data ?? [])
  }

  function openCreate() {
    setEditing(null)
    setForm({ nome: '', sku: '', descricao: '', categoria_id: '', unidade_medida: 'un', preco_custo: '', preco_venda: '', estoque_minimo: '0' })
    setDialogOpen(true)
  }

  function openEdit(p: Produto) {
    setEditing(p)
    setForm({
      nome: p.nome, sku: p.sku, descricao: p.descricao ?? '', categoria_id: p.categoria_id ?? '',
      unidade_medida: p.unidade_medida, preco_custo: String(p.preco_custo), preco_venda: String(p.preco_venda),
      estoque_minimo: String(p.estoque_minimo),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!empresa) return

    const payload = {
      empresa_id: empresa.id,
      nome: form.nome,
      sku: form.sku,
      descricao: form.descricao || null,
      categoria_id: form.categoria_id || null,
      unidade_medida: form.unidade_medida,
      preco_custo: parseFloat(form.preco_custo) || 0,
      preco_venda: parseFloat(form.preco_venda) || 0,
      estoque_minimo: parseInt(form.estoque_minimo) || 0,
    }

    if (editing) {
      const { error } = await supabase.from('produtos').update(payload).eq('id', editing.id)
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return }
      toast({ title: 'Produto atualizado', variant: 'success' })
    } else {
      const { error } = await supabase.from('produtos').insert(payload)
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return }
      toast({ title: 'Produto criado', variant: 'success' })
    }

    setDialogOpen(false)
    fetchProdutos()
  }

  async function handleDelete(p: Produto) {
    if (!confirm(`Excluir o produto "${p.nome}"? Ele será desativado.`)) return

    const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', p.id)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Produto excluído', variant: 'success' })
    fetchProdutos()
  }

  async function handleAddCategoria() {
    if (!empresa || !newCatNome.trim()) return

    const { error } = await supabase.from('categorias').insert({
      empresa_id: empresa.id,
      nome: newCatNome.trim(),
    })

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      return
    }

    toast({ title: 'Categoria criada', variant: 'success' })
    setNewCatNome('')
    fetchCategorias()
  }

  async function handleDeleteCategoria(catId: string, catNome: string) {
    if (!confirm(`Excluir a categoria "${catNome}"?`)) return

    const { error } = await supabase.from('categorias').delete().eq('id', catId)
    if (error) {
      toast({ title: 'Erro', description: 'Não é possível excluir: existem produtos nesta categoria', variant: 'destructive' })
      return
    }
    toast({ title: 'Categoria excluída', variant: 'success' })
    fetchCategorias()
  }

  const unidadeLabels: Record<string, string> = {
    un: 'Unidade',
    kg: 'Kg',
    lt: 'Litro',
    cx: 'Caixa',
    pct: 'Pacote',
  }

  const filtered = produtos.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    const matchCat = !filterCategoria || p.categoria_id === filterCategoria
    return matchSearch && matchCat
  })

  const margemMedia = produtos.length > 0
    ? produtos.reduce((sum, p) => sum + (p.preco_venda > 0 ? ((p.preco_venda - p.preco_custo) / p.preco_venda) * 100 : 0), 0) / produtos.length
    : 0

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* ===== Page Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-violet-500/20 blur-md" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/25">
              <Package className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Produtos</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Catálogo de produtos e preços</p>
          </div>
        </div>

        {canManageProducts && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setCatDialogOpen(true)}
              className="gap-2 w-full sm:w-auto order-1 sm:order-1 text-xs h-10"
            >
              <Tags className="h-4 w-4 shrink-0" />
              <span>Categorias</span>
            </Button>
            <Button
              onClick={openCreate}
              className="gap-2 w-full sm:w-auto order-2 sm:order-2 text-xs h-10 shadow-lg shadow-blue-500/20"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Novo Produto</span>
            </Button>
          </div>
        )}
      </div>

      {/* ===== Stats ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 stagger-children">
        {/* Produtos Ativos */}
        <div className="relative overflow-hidden rounded-xl border border-violet-500/10 bg-gradient-to-br from-card to-[#0d1320]">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-violet-500/10 blur-xl" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
          <CardContent className="relative p-3.5 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg bg-violet-500/20 blur-sm" />
              <div className="relative p-2 rounded-lg bg-violet-500/10">
                <Package className="h-4 w-4 text-violet-400" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-violet-300 truncate">{produtos.length}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Produtos Ativos</p>
            </div>
          </CardContent>
        </div>

        {/* Categorias */}
        <div className="relative overflow-hidden rounded-xl border border-blue-500/10 bg-gradient-to-br from-card to-[#0d1320]">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-blue-500/10 blur-xl" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <CardContent className="relative p-3.5 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg bg-blue-500/20 blur-sm" />
              <div className="relative p-2 rounded-lg bg-blue-500/10">
                <Tags className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-blue-300 truncate">{categorias.length}</p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">Categorias</p>
            </div>
          </CardContent>
        </div>

        {/* Margem Média */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/10 bg-gradient-to-br from-card to-[#0d1320] hidden sm:block">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-emerald-500/10 blur-xl" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          <CardContent className="relative p-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg bg-emerald-500/20 blur-sm" />
              <div className="relative p-2 rounded-lg bg-emerald-500/10">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-emerald-300 truncate">{margemMedia.toFixed(1)}%</p>
              <p className="text-[11px] text-zinc-500 font-medium">Margem Média</p>
            </div>
          </CardContent>
        </div>
      </div>

      {/* ===== Filters ===== */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>
        <div className="relative sm:max-w-xs">
          <Select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="w-full appearance-none pr-9 text-sm"
          >
            <option value="">Todas categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* ===== Product List ===== */}
      <Card className="border-white/[0.05]">
        <CardContent className="pt-4 sm:pt-6">
          {loading ? (
            <div className="py-8 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              {/* -- Desktop table -- */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      <TableHead>Status</TableHead>
                      {canManageProducts && <TableHead className="w-24">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold">{p.nome}</TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400">{p.sku}</TableCell>
                        <TableCell>{p.categoria?.nome ?? <span className="text-zinc-600">—</span>}</TableCell>
                        <TableCell>{unidadeLabels[p.unidade_medida] ?? p.unidade_medida}</TableCell>
                        <TableCell className="text-right text-zinc-400">{formatCurrency(p.preco_custo)}</TableCell>
                        <TableCell className="text-right font-semibold text-white">{formatCurrency(p.preco_venda)}</TableCell>
                        <TableCell>
                          <Badge variant={p.ativo ? 'success' : 'secondary'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        </TableCell>
                        {canManageProducts && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="flex flex-col items-center justify-center py-14">
                            <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                              <Package className="h-7 w-7 text-zinc-600" />
                            </div>
                            <p className="text-sm font-semibold text-zinc-400">Nenhum produto encontrado</p>
                            <p className="text-xs text-zinc-600 mt-1">
                              {search ? 'Tente ajustar sua busca' : 'Cadastre seu primeiro produto'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* -- Mobile cards -- */}
              <div className="md:hidden space-y-3">
                {filtered.map((p, idx) => (
                  <div
                    key={p.id}
                    className="group/card relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-card/80 to-[#0d1320]/80 active:scale-[0.985] transition-transform duration-150"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {/* Subtle gradient accent line at top */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

                    <div className="p-3.5">
                      <div className="flex gap-3">
                        {/* Product icon area */}
                        <div className="relative shrink-0">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-600/10 flex items-center justify-center border border-primary/10">
                            <Package className="h-5 w-5 text-blue-400/80" />
                          </div>
                        </div>

                        {/* Main info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-white text-sm truncate leading-tight">{p.nome}</p>
                              <p className="text-[11px] text-zinc-500 font-mono mt-0.5 tracking-wide">{p.sku}</p>
                            </div>
                            <Badge
                              variant={p.ativo ? 'success' : 'secondary'}
                              className="shrink-0 text-[10px] px-2 py-0.5 h-5"
                            >
                              {p.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>

                          {/* Category + unit row */}
                          <div className="flex items-center gap-2 mt-2">
                            {p.categoria?.nome ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                                <Tags className="h-3 w-3" />
                                {p.categoria.nome}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-600">— Sem categoria</span>
                            )}
                            <span className="text-[10px] text-zinc-600">·</span>
                            <span className="text-[10px] text-zinc-500">
                              {unidadeLabels[p.unidade_medida] ?? p.unidade_medida}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Price + actions row */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Preço</p>
                          <span className="text-base font-bold text-white tracking-tight">
                            {formatCurrency(p.preco_venda)}
                          </span>
                        </div>

                        {canManageProducts && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(p)}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/25 border border-blue-500/15 px-3 py-2 text-xs font-medium text-blue-400 transition-colors min-h-[40px]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/25 border border-red-500/15 px-3 py-2 text-xs font-medium text-red-400 transition-colors min-h-[40px]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 h-14 w-14 rounded-2xl bg-blue-500/10 blur-lg" />
                      <div className="relative h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <Package className="h-7 w-7 text-zinc-600" />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-zinc-400">Nenhum produto encontrado</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {search ? 'Tente ajustar sua busca' : 'Cadastre seu primeiro produto'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Produto dialog ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-left">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Package className="h-4 w-4 text-blue-400" />
              </div>
              <DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do produto" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Código SKU" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do produto" className="resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
                  <option value="">Nenhuma</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Unidade</Label>
                <Select value={form.unidade_medida} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })}>
                  <option value="un">Unidade</option>
                  <option value="kg">Kg</option>
                  <option value="lt">Litro</option>
                  <option value="cx">Caixa</option>
                  <option value="pct">Pacote</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Preço Custo</Label>
                <Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Preço Venda</Label>
                <Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Estoque Min.</Label>
                <Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome || !form.sku} className="shadow-lg shadow-blue-500/20">
              Salvar
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Categorias dialog ===== */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent onClose={() => setCatDialogOpen(false)}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-left">
              <div className="p-1.5 rounded-lg bg-violet-500/10">
                <Tags className="h-4 w-4 text-violet-400" />
              </div>
              <DialogTitle>Gerenciar Categorias</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add form */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Nome da nova categoria..."
                value={newCatNome}
                onChange={(e) => setNewCatNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategoria()}
                className="flex-1 sm:max-w-xs"
              />
              <Button onClick={handleAddCategoria} disabled={!newCatNome.trim()} className="gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                <span>Adicionar</span>
              </Button>
            </div>

            {/* Category list */}
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto -mr-1 pr-1">
              {categorias.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <div className="h-12 w-12 rounded-xl bg-white/[0.03] flex items-center justify-center mb-3">
                    <Tags className="h-5 w-5 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-500">Nenhuma categoria cadastrada</p>
                </div>
              ) : (
                categorias.map((cat) => (
                  <div
                    key={cat.id}
                    className="group flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-150"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Tags className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <span className="text-sm font-medium truncate">{cat.nome}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategoria(cat.id, cat.nome)}
                      className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
