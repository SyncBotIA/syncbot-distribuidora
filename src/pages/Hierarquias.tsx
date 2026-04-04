import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react'
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
        title: 'Não é possível excluir',
        description: error.message.includes('violates foreign key')
          ? 'Existem usuários vinculados a esta hierarquia.'
          : error.message,
        variant: 'destructive',
      })
      return
    }

    toast({ title: 'Hierarquia excluída', variant: 'success' })
    fetchHierarquias()
  }

  async function handleMove(h: Hierarquia, direction: 'up' | 'down') {
    const idx = hierarquias.findIndex((x) => x.id === h.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= hierarquias.length) return

    const other = hierarquias[swapIdx]
    const tempOrdem = -1

    // Usar ordem temporária para evitar conflito de unique constraint
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
      <div className="text-center py-12 text-muted-foreground">
        Apenas administradores podem gerenciar hierarquias.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hierarquias</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Hierarquia
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Níveis da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarquias.map((h, idx) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">{h.ordem}</TableCell>
                    <TableCell className="font-medium">{h.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{h.descricao ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={h.ativo ? 'success' : 'secondary'}>
                        {h.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMove(h, 'up')}
                          disabled={idx === 0}
                          title="Subir"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMove(h, 'down')}
                          disabled={idx === hierarquias.length - 1}
                          title="Descer"
                        >
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
              <Label>Descrição (opcional)</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do nível" />
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
