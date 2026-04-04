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
      .select('*, usuarios!clientes_vendedor_id_fkey(nome)')
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
        toast({ title: 'CNPJ nao encontrado', description: 'Verifique o numero e tente novamente', variant: 'destructive' })
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
        toast({ title: 'CEP nao encontrado', description: 'Verifique o numero e tente novamente', variant: 'destructive' })
        setBuscandoCep(false)
        return
      }
      const data = await res.json()
      if (data.erro) {
        toast({ title: 'CEP nao encontrado', description: 'Verifique o numero e tente novamente', variant: 'destructive' })
        setBuscandoCep(false)
        return
      }

      setForm((prev) => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade ? `${data.localidade}/${data.uf}` : prev.cidade,
      }))

      toast({ title: 'Endereco preenchido', description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`, variant: 'success' })
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

    // Auto-buscar quando completar 14 digitos
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
      cep: (c as Record<string, unknown>).cep as string ?? '',
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
            <UserCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie sua base de clientes</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <UserCheck className="h-5 w-5 text-blue-400" />
          <div>
            <p className="text-lg font-bold text-blue-300">{clientes.length}</p>
            <p className="text-[11px] text-blue-400/70 font-medium">Total de Clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <MapPin className="h-5 w-5 text-violet-400" />
          <div>
            <p className="text-lg font-bold text-violet-300">{totalCidades}</p>
            <p className="text-[11px] text-violet-400/70 font-medium">Cidades</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hidden sm:flex">
          <Building className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-emerald-300">{clientes.filter(c => c.cnpj).length}</p>
            <p className="text-[11px] text-emerald-400/70 font-medium">Com CNPJ</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CNPJ, telefone ou cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Carregando clientes...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Bairro</TableHead>
                  {isAdmin && <TableHead>Vendedor</TableHead>}
                  <TableHead className="w-16">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const vendedorNome = (c as Record<string, unknown>).usuarios as { nome: string } | null
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCnpjDisplay(c.cnpj)}</TableCell>
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
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6}>
                      <div className="flex flex-col items-center justify-center py-10">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                          <UserCheck className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Nenhum cliente encontrado</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {search ? 'Tente ajustar sua busca' : 'Adicione seu primeiro cliente'}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* CNPJ com busca automatica */}
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
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Digite o CNPJ para preencher automaticamente</p>
            </div>

            {/* CEP com busca automatica */}
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
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Digite o CEP para preencher endereco automaticamente</p>
            </div>

            <div className="space-y-2">
              <Label>Nome / Razao Social</Label>
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
              <Label>Endereco</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, numero" />
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
              <Label>Observacao</Label>
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
