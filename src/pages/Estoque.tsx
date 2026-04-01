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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, AlertTriangle, Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Produto, EstoqueMovimentacao, Usuario } from '@/types/database'

export default function Estoque() {
  const { usuario } = useAuth()
  const { empresa, canManageStock } = useEmpresa()
  const { toast } = useToast()
  const [produtos, setProdutos] = useState<(Produto & { estoque_atual: number })[]>([])
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState<'estoque' | 'historico'>('estoque')
  const [search, setSearch] = useState('')

  // Form
  const [formProdutoId, setFormProdutoId] = useState('')
  const [formTipo, setFormTipo] = useState<'entrada' | 'ajuste'>('entrada')
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

    // Calculate stock for each product
    const produtosComEstoque = await Promise.all(
      prods.map(async (p) => {
        const { data: movs } = await supabase
          .from('estoque_movimentacoes')
          .select('tipo, quantidade')
          .eq('produto_id', p.id)

        let estoque = 0
        for (const m of movs ?? []) {
          if (m.tipo === 'entrada' || m.tipo === 'cancelamento') estoque += m.quantidade
          else if (m.tipo === 'saida') estoque -= m.quantidade
          else if (m.tipo === 'ajuste') estoque = m.quantidade
        }

        return { ...p, estoque_atual: estoque }
      })
    )

    setProdutos(produtosComEstoque)
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
    return p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estoque</h1>
        {canManageStock && (
          <Button onClick={() => { setDialogOpen(true); setFormProdutoId(''); setFormTipo('entrada'); setFormQuantidade(''); setFormObs('') }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'estoque' ? 'default' : 'outline'} onClick={() => setTab('estoque')}>
          Estoque Atual
        </Button>
        <Button variant={tab === 'historico' ? 'default' : 'outline'} onClick={() => setTab('historico')}>
          Histórico
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {tab === 'estoque' ? (
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
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
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell className="text-right font-semibold">{p.estoque_atual}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.estoque_minimo}</TableCell>
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
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <TableCell>{formatDate(m.created_at)}</TableCell>
                    <TableCell>{(m.produto as unknown as Produto)?.nome ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={tipoVariant[m.tipo]}>{tipoLabel[m.tipo]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{m.quantidade}</TableCell>
                    <TableCell>{(m.usuario as unknown as Usuario)?.nome ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{m.observacao ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
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
              <Select value={formTipo} onChange={(e) => setFormTipo(e.target.value as 'entrada' | 'ajuste')}>
                <option value="entrada">Entrada</option>
                <option value="ajuste">Ajuste (definir quantidade)</option>
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
            <Button onClick={handleMovimentacao} disabled={!formProdutoId || !formQuantidade}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
