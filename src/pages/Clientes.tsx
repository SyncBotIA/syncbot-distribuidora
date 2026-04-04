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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Search, Phone, Trash2, Loader2, UserCheck, MapPin, Building } from 'lucide-react'
import type { Cliente, Usuario, EmpresaUsuario } from '@/types/database'

export default function Clientes() {
  const { usuario, isMaster } = useAuth()
  const { empresa, isAdmin } = useEmpresa()
  const { toast } = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<EmpresaUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [search, setSearch] = useState('')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const [form, setForm] = useState({
    nome: '', cnpj: '', cep: '', telefone: '', endereco: '', bairro: '', cidade: '', observacao: '', vendedor_id: '',
  })

  useEffect(() => {
    if (empresa) {
      fetchClientes()
      fetchVendedores()
    }
  }, [empresa])

  async function fetchClientes() {
    const query = supabase
      .from('clientes')
      .select('*, vendedor:usuarios!clientes_vendedor_id_fkey(nome)')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('nome')

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

  function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  async function buscarCnpj(cnpjRaw: string) {
    const digits = cnpjRaw.replace(/\D/g, '')
    if (digits.length !== 14) return

    setBuscandoCnpj(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) {
        toast({ title: 'CNPJ não encontrado', description: 'Verifique o número e tente novamente', variant: 'destructive' })
        setBuscandoCnpj(false)
        return
      }
      const data = await res.json()

      setForm((prev) => ({
        ...prev,
        nome: data.razao_social || data.nome_fantasia || prev.nome,
        telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.telefone,
        endereco: [data.logradouro, data.numero, data.complemento].filter(Boolean).join(', ') || prev.endereco,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio ? `${data.municipio}/${data.uf}` : prev.cidade,
      }))

      toast({ title: 'Dados preenchidos', description: `${data.razao_social || data.nome_fantasia}`, variant: 'success' })
    } catch {
      toast({ title: 'Erro ao buscar CNPJ', description: 'Tente novamente', variant: 'destructive' })
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function formatCep(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    return digits.replace(/^(\d{5})(\d)/, '$1-$2')
  }

  async function buscarCep(cepRaw: string) {
    const digits = cepRaw.replace(/\D/g, '')
    if (digits.length !== 8) return

    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) {
        toast({ title: 'CEP não encontrado', description: 'Verifique o número e tente novamente', variant: 'destructive' })
        setBuscandoCep(false)
        return
      }
      const data = await res.json()
      if (data.erro) {
        toast({ title: 'CEP não encontrado', description: 'Verifique o número e tente novamente', variant: 'destructive' })
        setBuscandoCep(false)
        return
      }

      setForm((prev) => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade ? `${data.localidade}/${data.uf}` : prev.cidade,
      }))

      toast({ title: 'Endereço preenchido', description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`, variant: 'success' })
    } catch {
      toast({ title: 'Erro ao buscar CEP', description: 'Tente novamente', variant: 'destructive' })
    } finally {
      setBuscandoCep(false)
    }
  }

  function handleCepChange(value: string) {
    const formatted = formatCep(value)
    setForm({ ...form, cep: formatted })

    const digits = value.replace(/\D/g, '')
    if (digits.length === 8) {
      buscarCep(digits)
    }
  }

  function handleCnpjChange(value: string) {
    const formatted = formatCnpj(value)
    setForm({ ...form, cnpj: formatted })

    const digits = value.replace(/\D/g, '')
    if (digits.length === 14) {
      buscarCnpj(digits)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({
      nome: '', cnpj: '', cep: '', telefone: '', endereco: '', bairro: '', cidade: '', observacao: '',
      vendedor_id: isAdmin ? '' : (usuario?.id ?? ''),
    })
    setDialogOpen(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    setForm({
      nome: c.nome,
      cnpj: c.cnpj ?? '',
      cep: c.cep ?? '',
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
      cnpj: form.cnpj.replace(/\D/g, '') || null,
      cep: form.cep.replace(/\D/g, '') || null,
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

  function canDeleteClient() {
    return isMaster || isAdmin
  }

  async function handleDelete(c: Cliente) {
    if (!confirm(`Remover cliente "${c.nome}"?`)) return

    try {
      const { error } = await supabase
        .from('clientes')
        .update({ ativo: false })
        .eq('id', c.id)
      if (error) throw error
      toast({ title: 'Cliente removido', variant: 'success' })
      fetchClientes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao remover'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  }

  function formatCnpjDisplay(cnpj: string | null) {
    if (!cnpj) return '—'
    const d = cnpj.replace(/\D/g, '')
    if (d.length !== 14) return cnpj
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase()
    return c.nome.toLowerCase().includes(q) ||
      (c.telefone?.toLowerCase().includes(q) ?? false) ||
      (c.cnpj?.includes(q.replace(/\D/g, '')) ?? false) ||
      (c.cidade?.toLowerCase().includes(q) ?? false)
  })

  const totalCidades = new Set(clientes.filter(c => c.cidade).map(c => c.cidade)).size

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/20">
            <UserCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Clientes</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Gerencie sua base de clientes</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Cliente</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 stagger-children">
        <Card className="border-cyan-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10">
              <UserCheck className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-cyan-300">{clientes.length}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Total de Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-violet-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <MapPin className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-violet-300">{totalCidades}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Cidades</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/10 hidden sm:block">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Building className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-300">{clientes.filter(c => c.cnpj).length}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Com CNPJ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input placeholder="Buscar por nome, CNPJ, telefone ou cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

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
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Bairro</TableHead>
                      {isAdmin && <TableHead>Vendedor</TableHead>}
                      <TableHead className="w-16">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-semibold">{c.nome}</TableCell>
                          <TableCell className="font-mono text-xs text-zinc-400">{formatCnpjDisplay(c.cnpj)}</TableCell>
                          <TableCell>
                            {c.telefone ? (
                              <span className="flex items-center gap-1.5 text-zinc-300">
                                <Phone className="h-3 w-3 text-zinc-500" />
                                {c.telefone}
                              </span>
                            ) : <span className="text-zinc-600">—</span>}
                          </TableCell>
                          <TableCell>{c.cidade ?? <span className="text-zinc-600">—</span>}</TableCell>
                          <TableCell>{c.bairro ?? <span className="text-zinc-600">—</span>}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Badge variant="outline">{(c.vendedor as Usuario)?.nome ?? '—'}</Badge>
                            </TableCell>
                          )}
                          <TableCell className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canDeleteClient() && (
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 7 : 6}>
                          <div className="flex flex-col items-center justify-center py-14">
                            <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                              <UserCheck className="h-7 w-7 text-zinc-600" />
                            </div>
                            <p className="text-sm font-semibold text-zinc-400">Nenhum cliente encontrado</p>
                            <p className="text-xs text-zinc-600 mt-1">
                              {search ? 'Tente ajustar sua busca' : 'Adicione seu primeiro cliente'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filtered.map((c) => (
                  <div key={c.id} className="rounded-xl border border-white/[0.06] p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate">{c.nome}</p>
                        {c.cnpj && <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{formatCnpjDisplay(c.cnpj)}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-10 w-10">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDeleteClient() && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="h-10 w-10">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                      {c.telefone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-zinc-500" />{c.telefone}</span>
                      )}
                      {c.cidade && <span>{c.cidade}</span>}
                      {c.bairro && <span>{c.bairro}</span>}
                    </div>
                    {isAdmin && c.vendedor && (
                      <Badge variant="outline" className="text-xs">{(c.vendedor as Usuario)?.nome ?? '—'}</Badge>
                    )}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14">
                    <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                      <UserCheck className="h-7 w-7 text-zinc-600" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-400">Nenhum cliente encontrado</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {search ? 'Tente ajustar sua busca' : 'Adicione seu primeiro cliente'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <div className="relative">
                <Input
                  value={form.cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                {buscandoCnpj && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">Digite o CNPJ para preencher automaticamente</p>
            </div>

            <div className="space-y-2">
              <Label>CEP</Label>
              <div className="relative">
                <Input
                  value={form.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {buscandoCep && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">Digite o CEP para preencher endereço automaticamente</p>
            </div>

            <div className="space-y-2">
              <Label>Nome / Razão Social</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observações sobre o cliente" />
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
