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
import { Plus, Pencil, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Produto, Categoria } from '@/types/database'

export default function Produtos() {
  const { empresa, canManageProducts } = useEmpresa()
  const { toast } = useToast()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')

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
      .select('*, categorias(*)')
      .eq('empresa_id', empresa!.id)
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

  const filtered = produtos.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    const matchCat = !filterCategoria || p.categoria_id === filterCategoria
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        {canManageProducts && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        )}
      </div>

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
            <p className="text-muted-foreground">Carregando...</p>
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
                  {canManageProducts && <TableHead className="w-16">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell>{(p.categoria as unknown as Categoria)?.nome ?? '—'}</TableCell>
                    <TableCell>{p.unidade_medida}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_custo)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_venda)}</TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? 'success' : 'secondary'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </TableCell>
                    {canManageProducts && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum produto encontrado</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
              <Label>Descrição</Label>
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
                <Label>Preço Custo</Label>
                <Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Preço Venda</Label>
                <Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Estoque Mín.</Label>
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
    </div>
  )
}
