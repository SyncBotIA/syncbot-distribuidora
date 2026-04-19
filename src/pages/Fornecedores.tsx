import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Pencil, Search, Phone, Trash2, Loader2, Factory, Building, Building2,
  Sparkles, Download, Upload, ChevronDown, ChevronRight, Mail, Globe, MapPin,
  CreditCard, Handshake, FileText, User,
} from 'lucide-react'
import { exportToCSV, fornecedorColumns } from '@/lib/export'
import FornecedorImportDialog from '@/components/fornecedores/FornecedorImportDialog'
import type { Fornecedor } from '@/types/database'

type FormState = {
  razao_social: string
  nome_fantasia: string
  cnpj: string
  inscricao_estadual: string
  inscricao_municipal: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  telefone: string
  celular: string
  email: string
  site: string
  contato_nome: string
  contato_cargo: string
  prazo_pagamento_dias: string
  forma_pagamento: string
  valor_minimo_pedido: string
  prazo_entrega_dias: string
  condicoes_especiais: string
  banco: string
  agencia: string
  conta: string
  chave_pix: string
  observacao: string
}

const emptyForm: FormState = {
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '', inscricao_municipal: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  telefone: '', celular: '', email: '', site: '', contato_nome: '', contato_cargo: '',
  prazo_pagamento_dias: '', forma_pagamento: '', valor_minimo_pedido: '', prazo_entrega_dias: '', condicoes_especiais: '',
  banco: '', agencia: '', conta: '', chave_pix: '',
  observacao: '',
}

function formatCnpjDisplay(cnpj: string | null) {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatCnpjInput(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCepInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

export default function Fornecedores() {
  const { empresa } = useEmpresa()
  const { has } = usePermissions()
  const { toast } = useToast()

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [search, setSearch] = useState('')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [sections, setSections] = useState({
    identificacao: true,
    endereco: false,
    contato: false,
    comercial: false,
    bancario: false,
    observacao: false,
  })

  const canCreate = has('fornecedores.criar')
  const canEdit = has('fornecedores.editar')
  const canDelete = has('fornecedores.excluir')
  const canImport = has('fornecedores.importar')

  useEffect(() => {
    if (empresa) fetchFornecedores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa])

  async function fetchFornecedores() {
    setLoading(true)
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('razao_social')

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
    setFornecedores((data ?? []) as Fornecedor[])
    setLoading(false)
  }

  async function buscarCnpj(digits: string) {
    if (digits.length !== 14) return
    setBuscandoCnpj(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) {
        toast({ title: 'CNPJ nao encontrado', variant: 'destructive' })
        return
      }
      const data = await res.json()
      setForm((prev) => ({
        ...prev,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia,
        cep: data.cep ? formatCepInput(data.cep) : prev.cep,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf,
        email: data.email || prev.email,
        telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.telefone,
      }))
      toast({ title: 'Dados preenchidos', description: data.razao_social, variant: 'success' })
    } catch {
      toast({ title: 'Erro ao buscar CNPJ', variant: 'destructive' })
    } finally {
      setBuscandoCnpj(false)
    }
  }

  async function buscarCep(digits: string) {
    if (digits.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) {
        toast({ title: 'CEP nao encontrado', variant: 'destructive' })
        return
      }
      setForm((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
      }))
      toast({ title: 'Endereco preenchido', variant: 'success' })
    } catch {
      toast({ title: 'Erro ao buscar CEP', variant: 'destructive' })
    } finally {
      setBuscandoCep(false)
    }
  }

  function handleCnpjChange(v: string) {
    const formatted = formatCnpjInput(v)
    setForm({ ...form, cnpj: formatted })
    const d = v.replace(/\D/g, '')
    if (d.length === 14) buscarCnpj(d)
  }

  function handleCepChange(v: string) {
    const formatted = formatCepInput(v)
    setForm({ ...form, cep: formatted })
    const d = v.replace(/\D/g, '')
    if (d.length === 8) buscarCep(d)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setSections({ identificacao: true, endereco: false, contato: false, comercial: false, bancario: false, observacao: false })
    setDialogOpen(true)
  }

  function openEdit(f: Fornecedor) {
    setEditing(f)
    setForm({
      razao_social: f.razao_social ?? '',
      nome_fantasia: f.nome_fantasia ?? '',
      cnpj: f.cnpj ? formatCnpjInput(f.cnpj) : '',
      inscricao_estadual: f.inscricao_estadual ?? '',
      inscricao_municipal: f.inscricao_municipal ?? '',
      cep: f.cep ? formatCepInput(f.cep) : '',
      logradouro: f.logradouro ?? '',
      numero: f.numero ?? '',
      complemento: f.complemento ?? '',
      bairro: f.bairro ?? '',
      cidade: f.cidade ?? '',
      uf: f.uf ?? '',
      telefone: f.telefone ?? '',
      celular: f.celular ?? '',
      email: f.email ?? '',
      site: f.site ?? '',
      contato_nome: f.contato_nome ?? '',
      contato_cargo: f.contato_cargo ?? '',
      prazo_pagamento_dias: f.prazo_pagamento_dias != null ? String(f.prazo_pagamento_dias) : '',
      forma_pagamento: f.forma_pagamento ?? '',
      valor_minimo_pedido: f.valor_minimo_pedido != null ? String(f.valor_minimo_pedido) : '',
      prazo_entrega_dias: f.prazo_entrega_dias != null ? String(f.prazo_entrega_dias) : '',
      condicoes_especiais: f.condicoes_especiais ?? '',
      banco: f.banco ?? '',
      agencia: f.agencia ?? '',
      conta: f.conta ?? '',
      chave_pix: f.chave_pix ?? '',
      observacao: f.observacao ?? '',
    })
    setSections({ identificacao: true, endereco: false, contato: false, comercial: false, bancario: false, observacao: false })
    setDialogOpen(true)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!empresa || !form.razao_social.trim()) {
      toast({ title: 'Informe a razao social', variant: 'destructive' })
      return
    }

    const payload = {
      empresa_id: empresa.id,
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cnpj: form.cnpj.replace(/\D/g, '') || null,
      inscricao_estadual: form.inscricao_estadual.trim() || null,
      inscricao_municipal: form.inscricao_municipal.trim() || null,
      cep: form.cep.replace(/\D/g, '') || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase() || null,
      telefone: form.telefone.trim() || null,
      celular: form.celular.trim() || null,
      email: form.email.trim() || null,
      site: form.site.trim() || null,
      contato_nome: form.contato_nome.trim() || null,
      contato_cargo: form.contato_cargo.trim() || null,
      prazo_pagamento_dias: form.prazo_pagamento_dias ? parseInt(form.prazo_pagamento_dias, 10) : null,
      forma_pagamento: form.forma_pagamento.trim() || null,
      valor_minimo_pedido: form.valor_minimo_pedido ? parseFloat(form.valor_minimo_pedido.replace(',', '.')) : null,
      prazo_entrega_dias: form.prazo_entrega_dias ? parseInt(form.prazo_entrega_dias, 10) : null,
      condicoes_especiais: form.condicoes_especiais.trim() || null,
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      chave_pix: form.chave_pix.trim() || null,
      observacao: form.observacao.trim() || null,
    }

    if (editing) {
      const { error } = await supabase.from('fornecedores').update(payload).eq('id', editing.id)
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      toast({ title: 'Fornecedor atualizado', variant: 'success' })
    } else {
      const { error } = await supabase.from('fornecedores').insert(payload)
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
      toast({ title: 'Fornecedor criado', variant: 'success' })
    }

    setDialogOpen(false)
    fetchFornecedores()
  }

  async function handleDelete(f: Fornecedor) {
    if (!confirm(`Remover fornecedor "${f.razao_social}"?`)) return
    const { error } = await supabase.from('fornecedores').update({ ativo: false }).eq('id', f.id)
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    toast({ title: 'Fornecedor removido', variant: 'success' })
    fetchFornecedores()
  }

  const filtered = fornecedores.filter((f) => {
    const q = search.toLowerCase()
    return (
      f.razao_social.toLowerCase().includes(q) ||
      (f.nome_fantasia?.toLowerCase().includes(q) ?? false) ||
      (f.cnpj?.includes(q.replace(/\D/g, '')) ?? false) ||
      (f.cidade?.toLowerCase().includes(q) ?? false) ||
      (f.contato_nome?.toLowerCase().includes(q) ?? false)
    )
  })

  const totalCnpj = fornecedores.filter((f) => f.cnpj).length
  const totalCidades = new Set(fornecedores.filter((f) => f.cidade).map((f) => f.cidade)).size

  function toggleSection(k: keyof typeof sections) {
    setSections((s) => ({ ...s, [k]: !s[k] }))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 ring-1 ring-amber-400/20">
            <Factory className="h-5 w-5 text-white" />
            <Sparkles className="h-3 w-3 text-amber-200/80 absolute -top-1 -right-1" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Fornecedores</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Gerencie sua cadeia de suprimentos</p>
          </div>
        </div>
        <div className="flex gap-2 self-start">
          {canImport && (
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
          )}
          {canCreate && (
            <Button onClick={openCreate} className="gap-2 shadow-lg shadow-amber-500/20">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Fornecedor</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 stagger-children">
        <Card className="relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-transparent">
          <CardContent className="p-3.5 sm:p-4 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-amber-400/20 blur-md" />
              <div className="relative p-2 rounded-xl bg-amber-500/15 ring-1 ring-amber-400/20">
                <Factory className="h-5 w-5 text-amber-400" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600 leading-tight">{fornecedores.length}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent">
          <CardContent className="p-3.5 sm:p-4 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-violet-400/20 blur-md" />
              <div className="relative p-2 rounded-xl bg-violet-500/15 ring-1 ring-violet-400/20">
                <MapPin className="h-5 w-5 text-violet-400" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-violet-600 leading-tight">{totalCidades}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Cidades</p>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent hidden sm:block">
          <CardContent className="p-3.5 sm:p-4 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-emerald-400/20 blur-md" />
              <div className="relative p-2 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/20">
                <Building className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-600 leading-tight">{totalCnpj}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Com CNPJ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CNPJ, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(filtered as unknown as Record<string, unknown>[], 'fornecedores', fornecedorColumns)}
          title="Exportar CSV"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      <Card className="border-[var(--theme-subtle-border)]">
        <CardContent className="pt-4 sm:pt-6">
          {loading ? (
            <div className="py-8 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razao Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-16">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-foreground">{f.razao_social}</p>
                            {f.nome_fantasia && <p className="text-[11px] text-muted-foreground mt-0.5">{f.nome_fantasia}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatCnpjDisplay(f.cnpj)}</TableCell>
                        <TableCell>
                          {f.cidade ? `${f.cidade}${f.uf ? '/' + f.uf : ''}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {f.contato_nome ? (
                            <div>
                              <p className="text-sm">{f.contato_nome}</p>
                              {f.contato_cargo && <p className="text-[11px] text-muted-foreground">{f.contato_cargo}</p>}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {f.telefone ? (
                            <span className="flex items-center gap-1.5 text-foreground text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {f.telefone}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(f)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-14">
                            <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                              <Factory className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Nenhum fornecedor encontrado</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {search ? 'Tente ajustar sua busca' : 'Adicione seu primeiro fornecedor'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-2.5">
                {filtered.map((f) => (
                  <div
                    key={f.id}
                    className="group relative overflow-hidden rounded-xl border border-[var(--theme-subtle-border)] bg-gradient-to-br from-white/[0.03] via-transparent to-transparent p-3.5 space-y-2.5 active:scale-[0.98] transition-transform duration-150"
                  >
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/40 via-orange-500/20 to-transparent" />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-sm truncate leading-tight">{f.razao_social}</p>
                        {f.nome_fantasia && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{f.nome_fantasia}</p>
                        )}
                        {f.cnpj && (
                          <p className="text-[11px] text-muted-foreground font-mono mt-1 tracking-wide">{formatCnpjDisplay(f.cnpj)}</p>
                        )}
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(f)} className="h-9 w-9 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 active:scale-90 transition-all">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(f)} className="h-9 w-9 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {(f.telefone || f.cidade || f.contato_nome) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        {f.telefone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            {f.telefone}
                          </span>
                        )}
                        {f.cidade && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-violet-400/70" />
                            {f.cidade}{f.uf ? '/' + f.uf : ''}
                          </span>
                        )}
                        {f.contato_nome && (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-cyan-400/70" />
                            {f.contato_nome}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-[var(--theme-subtle-border)] flex items-center justify-center mb-4">
                      <Factory className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Nenhum fornecedor encontrado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search ? 'Tente ajustar sua busca' : 'Adicione seu primeiro fornecedor'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog CRUD */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-amber-400" />
              {editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-3">
              {/* Identificacao */}
              <Section
                icon={<Building2 className="h-4 w-4 text-amber-400" />}
                title="Identificacao"
                open={sections.identificacao}
                onToggle={() => toggleSection('identificacao')}
              >
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <div className="relative">
                    <Input value={form.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} />
                    {buscandoCnpj && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-400/60" />
                    Digite o CNPJ para preencher automaticamente
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Razao Social *</Label>
                  <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Inscricao Estadual</Label>
                    <Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Inscricao Municipal</Label>
                    <Input value={form.inscricao_municipal} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} />
                  </div>
                </div>
              </Section>

              {/* Endereco */}
              <Section
                icon={<MapPin className="h-4 w-4 text-violet-400" />}
                title="Endereco"
                open={sections.endereco}
                onToggle={() => toggleSection('endereco')}
              >
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input value={form.cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
                    {buscandoCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-amber-400" />}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                  <div className="space-y-2">
                    <Label>Logradouro</Label>
                    <Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Numero</Label>
                    <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} />
                  </div>
                </div>
              </Section>

              {/* Contato */}
              <Section
                icon={<Phone className="h-4 w-4 text-cyan-400" />}
                title="Contato"
                open={sections.contato}
                onToggle={() => toggleSection('contato')}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <PhoneInput value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Celular</Label>
                    <PhoneInput value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> Site</Label>
                  <Input type="url" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nome do contato</Label>
                    <Input value={form.contato_nome} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input value={form.contato_cargo} onChange={(e) => setForm({ ...form, contato_cargo: e.target.value })} />
                  </div>
                </div>
              </Section>

              {/* Comercial */}
              <Section
                icon={<Handshake className="h-4 w-4 text-emerald-400" />}
                title="Condicoes Comerciais"
                open={sections.comercial}
                onToggle={() => toggleSection('comercial')}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Prazo de pagamento (dias)</Label>
                    <Input type="number" min="0" value={form.prazo_pagamento_dias} onChange={(e) => setForm({ ...form, prazo_pagamento_dias: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Forma de pagamento</Label>
                    <Select value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}>
                      <option value="">Selecionar</option>
                      <option value="a_vista">A vista</option>
                      <option value="boleto">Boleto</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartao</option>
                      <option value="prazo">A prazo</option>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor minimo do pedido</Label>
                    <Input type="text" inputMode="decimal" value={form.valor_minimo_pedido} onChange={(e) => setForm({ ...form, valor_minimo_pedido: e.target.value })} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo de entrega (dias)</Label>
                    <Input type="number" min="0" value={form.prazo_entrega_dias} onChange={(e) => setForm({ ...form, prazo_entrega_dias: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Condicoes especiais</Label>
                  <Textarea value={form.condicoes_especiais} onChange={(e) => setForm({ ...form, condicoes_especiais: e.target.value })} placeholder="Ex: desconto progressivo, frete incluso..." />
                </div>
              </Section>

              {/* Bancario */}
              <Section
                icon={<CreditCard className="h-4 w-4 text-blue-400" />}
                title="Dados Bancarios"
                open={sections.bancario}
                onToggle={() => toggleSection('bancario')}
              >
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_130px] gap-3">
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Agencia</Label>
                    <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} placeholder="CNPJ, email, telefone, aleatoria" />
                </div>
              </Section>

              {/* Observacao */}
              <Section
                icon={<FileText className="h-4 w-4 text-zinc-400" />}
                title="Observacao"
                open={sections.observacao}
                onToggle={() => toggleSection('observacao')}
              >
                <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Anote informacoes relevantes sobre este fornecedor" rows={4} />
              </Section>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={!form.razao_social.trim()}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Importacao */}
      {importOpen && (
        <FornecedorImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false)
            fetchFornecedores()
          }}
        />
      )}
    </div>
  )
}

function Section({
  icon, title, open, onToggle, children,
}: {
  icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--theme-subtle-border)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--theme-subtle-bg)] hover:bg-[var(--theme-subtle-bg-hover)] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}
