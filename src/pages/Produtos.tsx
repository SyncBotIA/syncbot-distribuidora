import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
import { Plus, Pencil, Search, Trash2, Tags, Package, BarChart3 } from 'lucide-react'
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

  // Form
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
    if (!confirm(`Excluir o produto "${p.nome}"? Ele sera desativado.`)) return

    const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', p.id)
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Produto excluido', variant: 'success' })
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
      toast({ title: 'Erro', description: 'Nao e possivel excluir: existem produtos nesta categoria', variant: 'destructive' })
      return
    }
    toast({ title: 'Categoria excluida', variant: 'success' })
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
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/20">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Catalogo de produtos e precos</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canManageProducts && (
            <>
              <Button variant="outline" onClick={() => setCatDialogOpen(true)} className="gap-2">
                <Tags className="h-4 w-4" />
                Categorias
              </Button>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Produto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Package className="h-5 w-5 text-violet-400" />
          <div>
            <p className="text-lg font-bold text-violet-300">{produtos.length}</p>
            <p className="text-[11px] text-violet-400/70 font-medium">Produtos Ativos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Tags className="h-5 w-5 text-blue-400" />
          <div>
            <p className="text-lg font-bold text-blue-300">{categorias.length}</p>
            <p className="text-[11px] text-blue-400/70 font-medium">Categorias</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hidden sm:flex">
          <BarChart3 className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-emerald-300">{margemMedia.toFixed(1)}%</p>
            <p className="text-[11px] text-emerald-400/70 font-medium">Margem Media</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="max-w-xs">
          <option value="">Todas categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Carregando produtos...</p>
              </div>
            </div>
          ) : (
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
                  {canManageProducts && <TableHead className="w-24">Acoes</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell>{(p.categoria as unknown as Categoria)?.nome ?? '—'}</TableCell>
                    <TableCell>{unidadeLabels[p.unidade_medida] ?? p.unidade_medida}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_custo)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_venda)}</TableCell>
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
                      <div className="flex flex-col items-center justify-center py-10">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                          <Package className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Nenhum produto encontrado</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {search ? 'Tente ajustar sua busca' : 'Cadastre seu primeiro produto'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Produto dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
                  <option value="">Nenhuma</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unidade_medida} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })}>
                  <option value="un">Unidade</option>
                  <option value="kg">Kg</option>
                  <option value="lt">Litro</option>
                  <option value="cx">Caixa</option>
                  <option value="pct">Pacote</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Preco Custo</Label>
                <Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Preco Venda</Label>
                <Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Estoque Min.</Label>
                <Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome || !form.sku}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categorias dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent onClose={() => setCatDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da nova categoria..."
                value={newCatNome}
                onChange={(e) => setNewCatNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategoria()}
              />
              <Button onClick={handleAddCategoria} disabled={!newCatNome.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {categorias.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma categoria cadastrada</p>
              ) : (
                categorias.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-2 rounded border">
                    <span>{cat.nome}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCategoria(cat.id, cat.nome)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
