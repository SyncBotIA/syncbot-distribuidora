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
import { Plus, Pencil, Search, Phone, MapPin } from 'lucide-react'
import type { Cliente, Usuario, EmpresaUsuario } from '@/types/database'

export default function Clientes() {
  const { usuario } = useAuth()
  const { empresa, isAdmin } = useEmpresa()
  const { toast } = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<EmpresaUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    nome: '', telefone: '', endereco: '', bairro: '', cidade: '', observacao: '', vendedor_id: '',
  })

  useEffect(() => {
    if (empresa) {
      fetchClientes()
      fetchVendedores()
    }
  }, [empresa])

  async function fetchClientes() {
    let query = supabase
      .from('clientes')
      .select('*, usuarios!clientes_vendedor_id_fkey(nome)')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('nome')

    // Non-admin sees only their own clients
    if (!isAdmin && usuario) {
      query = query.eq('vendedor_id', usuario.id)
    }

    const { data } = await query
    setClientes(data ?? [])
    setLoading(false)
  }

  async function fetchVendedores() {
    const { data } = await supabase
      .from('empresa_usuarios')
      .select('*, usuarios(nome)')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)

    setVendedores(data ?? [])
  }

  function openCreate() {
    setEditing(null)
    setForm({
      nome: '', telefone: '', endereco: '', bairro: '', cidade: '', observacao: '',
      vendedor_id: isAdmin ? '' : (usuario?.id ?? ''),
    })
    setDialogOpen(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? '',
      endereco: c.endereco ?? '',
      bairro: c.bairro ?? '',
      cidade: c.cidade ?? '',
      observacao: c.observacao ?? '',
      vendedor_id: c.vendedor_id ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!empresa) return

    const payload = {
      empresa_id: empresa.id,
      nome: form.nome,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      observacao: form.observacao || null,
      vendedor_id: form.vendedor_id || null,
    }

    if (editing) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', editing.id)
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return }
      toast({ title: 'Cliente atualizado', variant: 'success' })
    } else {
      const { error } = await supabase.from('clientes').insert(payload)
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return }
      toast({ title: 'Cliente criado', variant: 'success' })
    }

    setDialogOpen(false)
    fetchClientes()
  }

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase()
    return c.nome.toLowerCase().includes(q) ||
      (c.telefone?.toLowerCase().includes(q) ?? false) ||
      (c.cidade?.toLowerCase().includes(q) ?? false)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Bairro</TableHead>
                  {isAdmin && <TableHead>Vendedor</TableHead>}
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const vendedorNome = (c as Record<string, unknown>).usuarios as { nome: string } | null
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        {c.telefone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.telefone}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{c.cidade ?? '—'}</TableCell>
                      <TableCell>{c.bairro ?? '—'}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Badge variant="outline">{vendedorNome?.nome ?? '—'}</Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
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
            <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número" />
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={form.vendedor_id} onChange={(e) => setForm({ ...form, vendedor_id: e.target.value })}>
                  <option value="">Nenhum</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.usuario_id}>
                      {(v.usuario as unknown as Usuario)?.nome}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
