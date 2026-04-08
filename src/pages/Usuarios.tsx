import { useEffect, useRef, useState } from 'react'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Trash2, Users, Search, ShieldCheck, Pencil } from 'lucide-react'
import type { EmpresaUsuario, Hierarquia } from '@/types/database'

const roleLevel = (name: string): number => {
  const n = name.toLowerCase()
  if (n.includes('admin')) return 3
  if (n.includes('gerente')) return 2
  return 1 // vendedor or unknown
}

const cachedUsuarios = { data: null as EmpresaUsuario[] | null, hierarquias: null as Hierarquia[] | null, empresaId: null as string | null };
cachedUsuarios.data = null;
cachedUsuarios.hierarquias = null;
cachedUsuarios.empresaId = null;

export default function Usuarios() {
  const { usuario, isMaster } = useAuth()
  const { empresa, empresaUsuario, hierarquiaOrdem, isAdmin } = useEmpresa()
  const { toast } = useToast()
  const initializedRef = useRef(false)
  const [usuarios, setUsuarios] = useState<EmpresaUsuario[]>(() => {
    if (cachedUsuarios.empresaId && cachedUsuarios.data) return cachedUsuarios.data
    return []
  })
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>(() => {
    if (cachedUsuarios.empresaId && cachedUsuarios.hierarquias) return cachedUsuarios.hierarquias
    return []
  })
  const [loading, setLoading] = useState(() => !cachedUsuarios.empresaId)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Form state (criar)
  const [formNome, setFormNome] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [formHierarquiaId, setFormHierarquiaId] = useState('')
  const [formSuperiorId, setFormSuperiorId] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<EmpresaUsuario | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editHierarquiaId, setEditHierarquiaId] = useState('')
  const [editSuperiorId, setEditSuperiorId] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const empresaIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (empresa && empresa.id !== empresaIdRef.current) {
      empresaIdRef.current = empresa.id
      initializedRef.current = true
      // Nao usar cache - sempre buscar dados atualizados para evitar contagens desatualizadas
      fetchUsuarios()
      fetchHierarquias()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa])

  async function fetchUsuarios() {
    setError(null)
    // Buscar empresa_usuarios primeiro
    const { data: euData, error: euError } = await supabase
      .from('empresa_usuarios')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)

    if (euError) {
      setError(euError.message)
      setLoading(false)
      return
    }

    if (!euData || euData.length === 0) {
      cachedUsuarios.data = []
      cachedUsuarios.empresaId = empresa!.id
      setUsuarios([])
      setLoading(false)
      return
    }

    // Buscar dados de usuarios
    const usuarioIds = euData.map(eu => eu.usuario_id)
    const hierarquiaIds = euData.map(eu => eu.hierarquia_id).filter(Boolean)

    const { data: usersData, error: usersError } = await supabase
      .from('usuarios')
      .select('*')
      .in('id', usuarioIds)

    if (usersError) {
      setError(usersError.message)
      setLoading(false)
      return
    }

    const { data: hierarquiasData, error: hierarquiasError } = await supabase
      .from('hierarquias')
      .select('*')
      .in('id', hierarquiaIds)

    if (hierarquiasError) {
      setError(hierarquiasError.message)
      setLoading(false)
      return
    }

    // Mapear por id
    const userMap = new Map((usersData ?? []).map(u => [u.id, u]))
    const hierarquiaMap = new Map((hierarquiasData ?? []).map(h => [h.id, h]))

    // Montar resultado
    const result = euData.map(eu => ({
      ...eu,
      usuario: userMap.get(eu.usuario_id),
      hierarquia: hierarquiaMap.get(eu.hierarquia_id),
    }))

    cachedUsuarios.data = result as EmpresaUsuario[]
    cachedUsuarios.empresaId = empresa!.id
    setUsuarios(result as EmpresaUsuario[])
    setLoading(false)
  }

  async function fetchHierarquias() {
    const { data } = await supabase
      .from('hierarquias')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('ordem')

    cachedUsuarios.hierarquias = data ?? []
    setHierarquias(data ?? [])
  }

  const myHierarquia = hierarquias.find(h => h.ordem === hierarquiaOrdem)
  const myRoleName = myHierarquia?.nome?.toLowerCase() || ''
  const myLevel = roleLevel(myRoleName)
  const availableHierarquias = isMaster
    ? hierarquias
    : hierarquias.filter((h) => roleLevel(h.nome) < myLevel)

  const availableSuperiors = usuarios.filter((eu) => {
    if (!formHierarquiaId) return false
    const selectedH = hierarquias.find((h) => h.id === formHierarquiaId)
    if (!selectedH) return false
    const euH = eu.hierarquia || eu.hierarquias as Hierarquia | undefined
    return euH && roleLevel(euH.nome) > roleLevel(selectedH.nome)
  })

  async function handleInvite() {
    if (!empresa || !usuario) return

    setSaving(true)
    try {
      const email = formEmail.toLowerCase().trim()
      let authId: string

      // 1. Tentar criar conta nova no Supabase Auth
      const { data: authData, error: authError } = await createIsolatedClient().auth.signUp({
        email,
        password: '123456',
        options: { data: { nome: formNome } },
      })

      if (authData?.user) {
        // Novo usuario criado com sucesso
        authId = authData.user.id
      } else if (authError?.message?.includes('already')) {
        // Usuario ja existe no Auth — buscar o auth_id direto do banco
        const { data: adminData, error: adminErr } = await supabase.rpc('get_or_create_auth_user_id', {
          p_email: email,
        })

        if (adminErr || !adminData) {
          toast({
            title: 'Email ja esta em uso',
            description: 'Este email ja foi cadastrado e nao foi possivel localizar o registro. Use outro email ou entre em contato com o suporte.',
            variant: 'destructive',
          })
          setSaving(false)
          return
        }

        authId = adminData
      } else {
        throw authError || new Error('Erro ao criar usuario')
      }

      // 3. Vincular a empresa via RPC
      const { error: linkError } = await supabase.rpc('convidar_usuario_com_auth_id', {
        p_empresa_id: empresa.id,
        p_nome: formNome,
        p_email: email,
        p_telefone: formTelefone || null,
        p_hierarquia_id: formHierarquiaId,
        p_superior_id: formSuperiorId || null,
        p_auth_id: authId,
      })

      if (linkError) throw linkError

      toast({ title: 'Usuario criado com sucesso', description: `Email: ${email} / Senha provisoria: 123456`, variant: 'success' })
      setDialogOpen(false)
      setFormNome('')
      setFormEmail('')
      setFormTelefone('')
      setFormHierarquiaId('')
      setFormSuperiorId('')
      fetchUsuarios()
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string }
      const message = e.message ?? e.details ?? e.hint ?? (typeof err === 'string' ? err : 'Erro desconhecido')
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function canEdit(eu: EmpresaUsuario) {
    // Pode editar a si mesmo (nome/telefone)
    if (eu.usuario_id === usuario?.id) return true
    // Master edita todos
    if (isMaster) return true
    // Admin edita todos
    if (isAdmin) return true
    // Superior edita subordinados
    const h = eu.hierarquia
    if (h && roleLevel(h.nome) < myLevel) return true
    return false
  }

  function openEditDialog(eu: EmpresaUsuario) {
    const u = eu.usuario
    const h = eu.hierarquia
    setEditingUser(eu)
    setEditNome(u?.nome || '')
    setEditTelefone(u?.telefone || '')
    setEditHierarquiaId(h?.id || '')
    setEditSuperiorId(eu.superior_id || '')
    setEditDialogOpen(true)
  }

  async function handleSaveEdit() {
    if (!editingUser || !usuario) return
    setEditSaving(true)

    try {
      const u = editingUser.usuario

      // Atualizar nome e telefone na tabela usuarios
      if (u) {
        const { error: userError } = await supabase
          .from('usuarios')
          .update({ nome: editNome, telefone: editTelefone || null })
          .eq('id', u.id)

        if (userError) throw userError
      }

      // Atualizar hierarquia e superior na empresa_usuarios (se tiver permissao)
      const isSelf = editingUser.usuario_id === usuario.id
      if (!isSelf && editHierarquiaId) {
        const updateData: Record<string, unknown> = { hierarquia_id: editHierarquiaId }
        if (editSuperiorId) updateData.superior_id = editSuperiorId
        else updateData.superior_id = null

        const { error: euError } = await supabase
          .from('empresa_usuarios')
          .update(updateData)
          .eq('id', editingUser.id)

        if (euError) throw euError
      }

      toast({ title: 'Usuario atualizado', variant: 'success' })
      setEditDialogOpen(false)
      setEditingUser(null)
      fetchUsuarios()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  function canDelete(eu: EmpresaUsuario) {
    // Nao pode excluir a si mesmo
    if (eu.usuario_id === usuario?.id) return false
    // Master exclui todos
    if (isMaster) return true
    // Gerente/admin exclui quem tem cargo inferior
    const h = eu.hierarquia
    if (h && roleLevel(h.nome) < myLevel) return true
    return false
  }

  async function handleDelete(eu: EmpresaUsuario) {
    const u = eu.usuario
    if (!usuario) return
    if (!confirm(`Remover "${u?.nome}" desta empresa?`)) return

    try {
      const { error } = await supabase.rpc('excluir_usuario_empresa', {
        p_quem_exclui_id: usuario.id,
        p_empresa_usuario_id: eu.id,
      })
      if (error) throw error
      toast({ title: 'Usuario removido', variant: 'success' })
      fetchUsuarios()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao remover'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  }

  const filtered = usuarios.filter((eu) => {
    const u = eu.usuario
    if (!u) return false
    const q = search.toLowerCase()
    return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const totalAtivos = usuarios.filter(eu => eu.usuario && eu.ativo).length

  return (
    <div className="space-y-3 sm:space-y-5 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-0 border-b border-white/[0.06] sm:border-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-blue-500/30 blur-md" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Usuários</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Equipe e permissões de acesso</p>
          </div>
        </div>
        {availableHierarquias.length > 0 && (
          <Button
            onClick={() => {
              setDialogOpen(true)
              setFormNome(''); setFormEmail(''); setFormTelefone('')
              setFormHierarquiaId(''); setFormSuperiorId('')
            }}
            className="gap-2 self-start min-h-[44px] sm:min-h-0"
          >
            <UserPlus className="h-4 w-4" />
            <span className="sm:inline hidden">Convidar</span>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500/[0.08] to-cyan-500/[0.02] border border-cyan-500/15 p-3.5 transition-all duration-300 hover:border-cyan-500/30">
          <div className="absolute top-0 right-0 h-16 w-16 rounded-full bg-cyan-500/10 blur-2xl -translate-y-4 translate-x-4" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/20">
              <Users className="h-[18px] w-[18px] text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-cyan-300 leading-none">{totalAtivos}</p>
              <p className="text-[11px] text-cyan-400/70 font-medium mt-1 truncate">Usuários Ativos</p>
            </div>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/[0.08] to-blue-500/[0.02] border border-blue-500/15 p-3.5 transition-all duration-300 hover:border-blue-500/30">
          <div className="absolute top-0 right-0 h-16 w-16 rounded-full bg-blue-500/10 blur-2xl -translate-y-4 translate-x-4" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/20">
              <ShieldCheck className="h-[18px] w-[18px] text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-blue-300 leading-none">{hierarquias.length}</p>
              <p className="text-[11px] text-blue-400/70 font-medium mt-1 truncate">Níveis de Hierarquia</p>
            </div>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/[0.08] to-violet-500/[0.02] border border-violet-500/15 p-3.5 transition-all duration-300 hover:border-violet-500/30 hidden sm:flex">
          <div className="absolute top-0 right-0 h-16 w-16 rounded-full bg-violet-500/10 blur-2xl -translate-y-4 translate-x-4" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/20">
              <UserPlus className="h-[18px] w-[18px] text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-violet-300 leading-none">{availableHierarquias.length}</p>
              <p className="text-[11px] text-violet-400/70 font-medium mt-1 truncate">Cargos Disponíveis</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 min-h-[44px] items-center justify-center rounded-lg bg-zinc-800/50">
          <Search className="h-4 w-4 text-zinc-500" />
        </div>
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-12 min-h-[44px]"
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl bg-red-500/8 border border-red-500/15 p-4 text-center">
          <p className="text-sm text-red-400">Erro ao carregar dados. {error}</p>
          <button onClick={fetchUsuarios} className="text-xs text-red-300 underline mt-2">Tentar novamente</button>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          {loading ? (
            <div className="py-8 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Hierarquia</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((eu) => {
                      const u = eu.usuario
                      const h = eu.hierarquia
                      return (
                        <TableRow key={eu.id}>
                          <TableCell className="font-medium">{u?.nome ?? '—'}</TableCell>
                          <TableCell>{u?.email ?? '—'}</TableCell>
                          <TableCell>{u?.telefone ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{h?.nome ?? '—'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={eu.ativo ? 'success' : 'secondary'}>
                              {eu.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {canEdit(eu) && (
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(eu)} title="Editar">
                                  <Pencil className="h-4 w-4 text-blue-400" />
                                </Button>
                              )}
                              {canDelete(eu) && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(eu)} title="Remover">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-10">
                            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                              <Users className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Nenhum usuário encontrado</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {search ? 'Tente ajustar sua busca' : 'Convide membros para a equipe'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((eu, index) => {
                  const u = eu.usuario
                  const h = eu.hierarquia
                  const initials = (u?.nome ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  const hue = eu.ativo !== false ? (index * 37) % 360 : 0

                  return (
                    <div
                      key={eu.id}
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] p-4 transition-all duration-300"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Subtle ambient glow */}
                      <div className="absolute -top-8 -left-8 h-20 w-20 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

                      <div className="relative flex items-center gap-3">
                        {/* Avatar */}
                        <div
                          className="flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${(hue + 40) % 360}, 65%, 45%))`,
                          }}
                        >
                          {initials}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white text-sm truncate">{u?.nome ?? '—'}</p>
                            <Badge
                              variant={eu.ativo ? 'success' : 'secondary'}
                              className="flex-shrink-0 text-[10px] px-1.5 py-0 h-5"
                            >
                              {eu.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">{u?.email ?? '—'}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {h && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/10 text-[11px] font-medium text-blue-300 ring-1 ring-blue-500/20">
                                {h.nome}
                              </span>
                            )}
                            {u?.telefone && (
                              <span className="text-[11px] text-zinc-500 font-mono">{u.telefone}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 flex-shrink-0 ml-1">
                          {canEdit(eu) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(eu)}
                              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-lg"
                            >
                              <Pencil className="h-4 w-4 text-blue-400" />
                            </Button>
                          )}
                          {canDelete(eu) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(eu)}
                              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-lg"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 rounded-2xl bg-white/[0.03] blur-xl" />
                      <div className="relative h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <Users className="h-6 w-6 text-zinc-600" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-zinc-400">Nenhum usuário encontrado</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {search ? 'Tente ajustar sua busca' : 'Convide membros para a equipe'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Convidar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/20">
                <UserPlus className="h-4 w-4 text-blue-400" />
              </div>
              Convidar Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome completo" className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" className="min-h-[44px]" />
            </div>
            {/* Password Notice */}
            <div className="relative overflow-hidden rounded-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-blue-500/10" />
              <div className="absolute inset-0 ring-1 ring-blue-500/20 rounded-xl" />
              <div className="relative p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 ring-1 ring-blue-500/30 flex-shrink-0">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-blue-300">
                      Senha provisória: <span className="font-mono font-bold text-blue-200 tracking-wider">123456</span>
                    </p>
                    <p className="text-[11px] text-blue-400/60 mt-0.5">O usuário será obrigado a redefinir no primeiro login</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone (opcional)</Label>
              <Input value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} placeholder="(00) 00000-0000" className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label>Hierarquia</Label>
              <Select key={formHierarquiaId || 'empty-select'} value={formHierarquiaId} onChange={(e) => setFormHierarquiaId((e.target as HTMLSelectElement).value)} className="min-h-[44px]">
                <option value="">Selecione...</option>
                {availableHierarquias.map((h) => (
                  <option key={h.id} value={h.id}>{h.nome}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Superior direto (opcional)</Label>
              <Select value={formSuperiorId} onChange={(e) => setFormSuperiorId(e.target.value)} className="min-h-[44px]">
                <option value="">Nenhum</option>
                {availableSuperiors.map((eu) => {
                  const u = eu.usuario
                  return (
                    <option key={eu.id} value={eu.id}>{u?.nome ?? 'Sem nome'}</option>
                  )
                })}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">Cancelar</Button>
            <Button onClick={handleInvite} disabled={!formNome || !formEmail || !formHierarquiaId || saving} className="min-h-[44px]">
              {saving ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Usuario */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent onClose={() => setEditDialogOpen(false)} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/20">
                <Pencil className="h-4 w-4 text-blue-400" />
              </div>
              Editar Usuario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} placeholder="Nome completo" className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} placeholder="(00) 00000-0000" className="min-h-[44px]" />
            </div>
            {editingUser && editingUser.usuario_id !== usuario?.id && (
              <>
                <div className="space-y-2">
                  <Label>Hierarquia</Label>
                  <Select value={editHierarquiaId} onChange={(e) => setEditHierarquiaId(e.target.value)} className="min-h-[44px]">
                    <option value="">Selecione...</option>
                    {isMaster
                      ? hierarquias.map((h) => (
                          <option key={h.id} value={h.id}>{h.nome}</option>
                        ))
                      : hierarquias.filter(h => roleLevel(h.nome) <= myLevel).map((h) => (
                      <option key={h.id} value={h.id}>{h.nome}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Superior direto</Label>
                  <Select value={editSuperiorId} onChange={(e) => setEditSuperiorId(e.target.value)} className="min-h-[44px]">
                    <option value="">Nenhum</option>
                    {usuarios.filter((eu) => {
                      if (!editHierarquiaId) return false
                      const selectedH = hierarquias.find((h) => h.id === editHierarquiaId)
                      if (!selectedH) return false
                      const euH = eu.hierarquia
                      return euH && roleLevel(euH.nome) > roleLevel(selectedH.nome)
                    }).map((eu) => {
                      const u = eu.usuario
                      return <option key={eu.id} value={eu.id}>{u?.nome}</option>
                    })}
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="min-h-[44px]">Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editNome || editSaving} className="min-h-[44px]">
              {editSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
