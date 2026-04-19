import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Factory, Plus, Pencil, Trash2, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

function CurrencyInput({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder?: string }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    const cents = parseInt(digits || '0', 10)
    onChange(String(cents / 100))
  }
  const num = parseFloat(value) || 0
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={num ? formatCurrency(num) : 'R$ 0,00'}
      placeholder={placeholder ?? 'R$ 0,00'}
      onChange={handleChange}
    />
  )
}
import type { Fornecedor, ProdutoFornecedor } from '@/types/database'

interface Props {
  produtoId: string
}

type Row = ProdutoFornecedor & { fornecedor?: Fornecedor }

interface LinkForm {
  fornecedor_id: string
  codigo_no_fornecedor: string
  preco_custo_ultimo: string
  prazo_entrega_dias: string
  quantidade_minima_compra: string
  embalagem: string
  fornecedor_preferencial: boolean
  observacao: string
}

const emptyLink: LinkForm = {
  fornecedor_id: '',
  codigo_no_fornecedor: '',
  preco_custo_ultimo: '',
  prazo_entrega_dias: '',
  quantidade_minima_compra: '',
  embalagem: '',
  fornecedor_preferencial: false,
  observacao: '',
}

export default function ProdutoFornecedoresSection({ produtoId }: Props) {
  const { empresa } = useEmpresa()
  const { toast } = useToast()

  const [rows, setRows] = useState<Row[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<LinkForm>(emptyLink)

  useEffect(() => {
    if (empresa && produtoId) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, produtoId])

  async function load() {
    setLoading(true)
    const [pf, forns] = await Promise.all([
      supabase
        .from('produto_fornecedores')
        .select('*, fornecedor:fornecedores(*)')
        .eq('produto_id', produtoId)
        .eq('ativo', true),
      supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', empresa!.id)
        .eq('ativo', true)
        .order('razao_social'),
    ])
    setRows((pf.data ?? []) as Row[])
    setFornecedores((forns.data ?? []) as Fornecedor[])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyLink)
    setDialogOpen(true)
  }

  function openEdit(r: Row) {
    setEditing(r)
    setForm({
      fornecedor_id: r.fornecedor_id,
      codigo_no_fornecedor: r.codigo_no_fornecedor ?? '',
      preco_custo_ultimo: r.preco_custo_ultimo != null ? String(r.preco_custo_ultimo) : '',
      prazo_entrega_dias: r.prazo_entrega_dias != null ? String(r.prazo_entrega_dias) : '',
      quantidade_minima_compra: r.quantidade_minima_compra != null ? String(r.quantidade_minima_compra) : '',
      embalagem: r.embalagem ?? '',
      fornecedor_preferencial: r.fornecedor_preferencial,
      observacao: r.observacao ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.fornecedor_id) {
      toast({ title: 'Selecione um fornecedor', variant: 'destructive' })
      return
    }

    const payload = {
      produto_id: produtoId,
      fornecedor_id: form.fornecedor_id,
      codigo_no_fornecedor: form.codigo_no_fornecedor.trim() || null,
      preco_custo_ultimo: form.preco_custo_ultimo ? parseFloat(form.preco_custo_ultimo.replace(',', '.')) : null,
      prazo_entrega_dias: form.prazo_entrega_dias ? parseInt(form.prazo_entrega_dias, 10) : null,
      quantidade_minima_compra: form.quantidade_minima_compra ? parseFloat(form.quantidade_minima_compra.replace(',', '.')) : null,
      embalagem: form.embalagem.trim() || null,
      fornecedor_preferencial: form.fornecedor_preferencial,
      observacao: form.observacao.trim() || null,
      ativo: true,
    }

    if (editing) {
      const { error } = await supabase.from('produto_fornecedores').update(payload).eq('id', editing.id)
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      toast({ title: 'Vinculo atualizado', variant: 'success' })
    } else {
      const { error } = await supabase.from('produto_fornecedores').insert(payload)
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      toast({ title: 'Fornecedor vinculado', variant: 'success' })
    }

    setDialogOpen(false)
    load()
  }

  async function handleDelete(r: Row) {
    if (!confirm(`Remover ${r.fornecedor?.razao_social ?? 'este fornecedor'} do produto?`)) return
    const { error } = await supabase.from('produto_fornecedores').update({ ativo: false }).eq('id', r.id)
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    toast({ title: 'Vinculo removido', variant: 'success' })
    load()
  }

  // Filtra fornecedores ja vinculados (exceto o que estamos editando)
  const available = fornecedores.filter((f) =>
    !rows.some((r) => r.fornecedor_id === f.id && (!editing || editing.fornecedor_id !== f.id))
  )

  return (
    <div className="space-y-3 pt-4 border-t border-[var(--theme-subtle-border)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-foreground">Fornecedores</span>
          <span className="text-[11px] text-muted-foreground">({rows.length})</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openCreate} className="gap-1.5 h-8 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--theme-subtle-border)] p-5 text-center">
          <Factory className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Nenhum fornecedor vinculado a este produto</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 rounded-xl border border-[var(--theme-subtle-border)] p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {r.fornecedor_preferencial && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                  <p className="font-semibold text-sm text-foreground truncate">{r.fornecedor?.razao_social ?? '—'}</p>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {r.codigo_no_fornecedor && <span>Cod: <span className="font-mono text-foreground">{r.codigo_no_fornecedor}</span></span>}
                  {r.preco_custo_ultimo != null && <span>Custo: <span className="text-emerald-400 font-semibold">{formatCurrency(r.preco_custo_ultimo)}</span></span>}
                  {r.prazo_entrega_dias != null && <span>{r.prazo_entrega_dias}d entrega</span>}
                  {r.embalagem && <span>{r.embalagem}</span>}
                </div>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(r)} className="h-8 w-8">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(r)} className="h-8 w-8">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-amber-400" />
              {editing ? 'Editar Vinculo' : 'Vincular Fornecedor'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <Select
                value={form.fornecedor_id}
                onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })}
                disabled={!!editing}
              >
                <option value="">Selecione...</option>
                {editing && editing.fornecedor && (
                  <option value={editing.fornecedor_id}>{editing.fornecedor.razao_social}</option>
                )}
                {available.map((f) => (
                  <option key={f.id} value={f.id}>{f.razao_social}</option>
                ))}
              </Select>
              {available.length === 0 && !editing && (
                <p className="text-[11px] text-muted-foreground">
                  Todos os fornecedores ja estao vinculados a este produto, ou nenhum foi cadastrado.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Codigo no fornecedor</Label>
                <Input
                  value={form.codigo_no_fornecedor}
                  onChange={(e) => setForm({ ...form, codigo_no_fornecedor: e.target.value })}
                  placeholder="SKU/codigo deles"
                />
              </div>
              <div className="space-y-2">
                <Label>Ultimo preco de custo</Label>
                <CurrencyInput
                  value={form.preco_custo_ultimo}
                  onChange={(val) => setForm({ ...form, preco_custo_ultimo: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Prazo entrega (dias)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.prazo_entrega_dias}
                  onChange={(e) => setForm({ ...form, prazo_entrega_dias: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. minima</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.quantidade_minima_compra}
                  onChange={(e) => setForm({ ...form, quantidade_minima_compra: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Embalagem</Label>
                <Input
                  value={form.embalagem}
                  onChange={(e) => setForm({ ...form, embalagem: e.target.value })}
                  placeholder="cx 12un"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--theme-subtle-border)] p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Fornecedor preferencial</p>
                <p className="text-[11px] text-muted-foreground">Marque para priorizar nas compras</p>
              </div>
              <Switch
                checked={form.fornecedor_preferencial}
                onCheckedChange={(v) => setForm({ ...form, fornecedor_preferencial: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Observacao</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={!form.fornecedor_id}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
