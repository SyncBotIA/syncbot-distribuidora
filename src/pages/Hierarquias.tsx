import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2, ShieldCheck, Layers } from 'lucide-react'
import type { Hierarquia } from '@/types/database'

export default function Hierarquias() {
  const { empresa, isAdmin } = useEmpresa()
  const { toast } = useToast()
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Hierarquia | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')

  useEffect(() => {
    if (empresa) fetchHierarquias()
  }, [empresa])

  async function fetchHierarquias() {
    const { data } = await supabase
      .from('hierarquias')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .order('ordem', { ascending: true })

    setHierarquias(data ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setNome('')
    setDescricao('')
    setDialogOpen(true)
  }

  function openEdit(h: Hierarquia) {
    setEditing(h)
    setNome(h.nome)
    setDescricao(h.descricao ?? '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!empresa) return

    if (editing) {
      const { error } = await supabase
        .from('hierarquias')
        .update({ nome, descricao: descricao || null })
        .eq('id', editing.id)

      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Hierarquia atualizada', variant: 'success' })
    } else {
      const maxOrdem = hierarquias.length > 0 ? Math.max(...hierarquias.map((h) => h.ordem)) : 0
      const { error } = await supabase
        .from('hierarquias')
        .insert({ empresa_id: empresa.id, nome, descricao: descricao || null, ordem: maxOrdem + 1 })

      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Hierarquia criada', variant: 'success' })
    }

    setDialogOpen(false)
    fetchHierarquias()
  }

  async function handleDelete(h: Hierarquia) {
    if (!confirm(`Excluir hierarquia "${h.nome}"?`)) return

    const { error } = await supabase.from('hierarquias').delete().eq('id', h.id)

    if (error) {
      toast({
        title: 'Nao e possivel excluir',
        description: error.message.includes('violates foreign key')
          ? 'Existem usuarios vinculados a esta hierarquia.'
          : error.message,
        variant: 'destructive',
      })
      return
    }

    toast({ title: 'Hierarquia excluida', variant: 'success' })
    fetchHierarquias()
  }

  async function handleMove(h: Hierarquia, direction: 'up' | 'down') {
    const idx = hierarquias.findIndex((x) => x.id === h.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= hierarquias.length) return

    const other = hierarquias[swapIdx]
    const tempOrdem = -1

    const { error: e1 } = await supabase.from('hierarquias').update({ ordem: tempOrdem }).eq('id', h.id)
    if (e1) { toast({ title: 'Erro ao mover', description: e1.message, variant: 'destructive' }); return }

    const { error: e2 } = await supabase.from('hierarquias').update({ ordem: h.ordem }).eq('id', other.id)
    if (e2) { toast({ title: 'Erro ao mover', description: e2.message, variant: 'destructive' }); return }

    const { error: e3 } = await supabase.from('hierarquias').update({ ordem: other.ordem }).eq('id', h.id)
    if (e3) { toast({ title: 'Erro ao mover', description: e3.message, variant: 'destructive' }); return }

    fetchHierarquias()
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
          <ShieldCheck className="h-8 w-8 text-zinc-600" />
        </div>
        <p className="text-zinc-400 font-medium">Acesso restrito</p>
        <p className="text-zinc-600 text-sm mt-1">Apenas administradores podem gerenciar hierarquias.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Hierarquias</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Estrutura organizacional e niveis de acesso</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Hierarquia</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 stagger-children">
        <Card className="border-indigo-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10">
              <Layers className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-indigo-300">{hierarquias.length}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Niveis Cadastrados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-300">{hierarquias.filter(h => h.ativo).length}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Niveis Ativos</p>
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
                <p className="text-sm text-zinc-500 font-medium">Carregando hierarquias...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarquias.map((h, idx) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <div className="h-7 w-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-300">
                        {h.ordem}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{h.nome}</TableCell>
                    <TableCell className="text-zinc-500">{h.descricao ?? <span className="text-zinc-600">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant={h.ativo ? 'success' : 'secondary'}>
                        {h.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleMove(h, 'up')} disabled={idx === 0} title="Subir">
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleMove(h, 'down')} disabled={idx === hierarquias.length - 1} title="Descer">
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(h)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(h)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Hierarquia' : 'Nova Hierarquia'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Gerente" />
            </div>
            <div className="space-y-2">
              <Label>Descricao (opcional)</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descricao do nivel" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
