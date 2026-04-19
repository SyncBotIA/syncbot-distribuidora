import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, CreditCard, Calendar, Wallet } from 'lucide-react'
import type { CondicaoPagamento, FormaPagamento } from '@/types/database'

type Tipo = 'condicao' | 'forma'

export default function ConfiguracoesPagamento() {
  const { empresa } = useEmpresa()
  const { has } = usePermissions()
  const { toast } = useToast()

  const [condicoes, setCondicoes] = useState<CondicaoPagamento[]>([])
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('condicao')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')

  const canEdit = has('configuracoes.pagamento')

  useEffect(() => {
    if (empresa) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa])

  async function load() {
    setLoading(true)
    const [c, f] = await Promise.all([
      supabase.from('condicoes_pagamento').select('*').eq('empresa_id', empresa!.id).eq('ativo', true).order('nome'),
      supabase.from('formas_pagamento').select('*').eq('empresa_id', empresa!.id).eq('ativo', true).order('nome'),
    ])
    setCondicoes((c.data ?? []) as CondicaoPagamento[])
    setFormas((f.data ?? []) as FormaPagamento[])
    setLoading(false)
  }

  function openCreate(t: Tipo) {
    setTipo(t)
    setEditingId(null)
    setNome('')
    setDialogOpen(true)
  }

  function openEdit(t: Tipo, item: CondicaoPagamento | FormaPagamento) {
    setTipo(t)
    setEditingId(item.id)
    setNome(item.nome)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!empresa || !nome.trim()) return toast({ title: 'Informe o nome', variant: 'destructive' })
    const table = tipo === 'condicao' ? 'condicoes_pagamento' : 'formas_pagamento'
    if (editingId) {
      const { error } = await supabase.from(table).update({ nome: nome.trim() }).eq('id', editingId)
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      toast({ title: 'Atualizado', variant: 'success' })
    } else {
      const { error } = await supabase.from(table).insert({ empresa_id: empresa.id, nome: nome.trim() })
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      toast({ title: 'Cadastrado', variant: 'success' })
    }
    setDialogOpen(false)
    load()
  }

  async function handleDelete(t: Tipo, item: CondicaoPagamento | FormaPagamento) {
    if (!confirm(`Remover "${item.nome}"?`)) return
    const table = t === 'condicao' ? 'condicoes_pagamento' : 'formas_pagamento'
    const { error } = await supabase.from(table).update({ ativo: false }).eq('id', item.id)
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    toast({ title: 'Removido', variant: 'success' })
    load()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/15">
          <Wallet className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Pagamento</h1>
          <p className="text-xs text-muted-foreground">Condicoes e formas de pagamento da empresa</p>
        </div>
      </div>

      <Section
        title="Condicoes de Pagamento"
        icon={<Calendar className="h-4 w-4 text-emerald-500" />}
        items={condicoes}
        canEdit={canEdit}
        onAdd={() => openCreate('condicao')}
        onEdit={(item) => openEdit('condicao', item)}
        onDelete={(item) => handleDelete('condicao', item)}
        empty="Nenhuma condicao cadastrada. Exemplos: A vista, 30 dias, 30/60/90."
      />

      <Section
        title="Formas de Pagamento"
        icon={<CreditCard className="h-4 w-4 text-violet-500" />}
        items={formas}
        canEdit={canEdit}
        onAdd={() => openCreate('forma')}
        onEdit={(item) => openEdit('forma', item)}
        onDelete={(item) => handleDelete('forma', item)}
        empty="Nenhuma forma cadastrada. Exemplos: PIX, Boleto, Dinheiro, Cartao."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar' : 'Nova'} {tipo === 'condicao' ? 'Condicao' : 'Forma'} de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={tipo === 'condicao' ? 'Ex: 30/60/90 dias' : 'Ex: PIX'}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  items: Array<{ id: string; nome: string }>
  canEdit: boolean
  onAdd: () => void
  onEdit: (item: { id: string; nome: string }) => void
  onDelete: (item: { id: string; nome: string }) => void
  empty: string
}

function Section({ title, icon, items, canEdit, onAdd, onEdit, onDelete, empty }: SectionProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <span className="text-[11px] text-muted-foreground">({items.length})</span>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--theme-subtle-border)] p-5 text-center">
            <p className="text-xs text-muted-foreground">{empty}</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-[var(--theme-subtle-border)] p-3"
              >
                <span className="text-sm text-foreground truncate">{item.nome}</span>
                {canEdit && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(item)} className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(item)} className="h-8 w-8">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
