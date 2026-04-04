import { useEffect, useState } from 'react'
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

export default function Usuarios() {
  const { usuario, isMaster } = useAuth()
  const { empresa, empresaUsuario, hierarquiaOrdem, isAdmin } = useEmpresa()
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<EmpresaUsuario[]>([])
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    if (empresa) {
      fetchUsuarios()
      fetchHierarquias()
    }
  }, [empresa])

  async function fetchUsuarios() {
    const { data } = await supabase
      .from('empresa_usuarios')
      .select('*, usuarios(*), hierarquias(*)')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
    let result = data ?? []

    if (!isAdmin && empresaUsuario) {
      const { data: subs } = await supabase.rpc('get_subordinados', {
        p_empresa_usuario_id: empresaUsuario.id,
      })
      const subIds = new Set((subs ?? []).map((s: { id: string }) => s.id))
      subIds.add(empresaUsuario.id)
      result = result.filter((eu) => subIds.has(eu.id))
    }

    setUsuarios(result)
    setLoading(false)
  }

  async function fetchHierarquias() {
    const { data } = await supabase
      .from('hierarquias')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('ordem')

    setHierarquias(data ?? [])
  }

  const availableHierarquias = hierarquias.filter(
    (h) => hierarquiaOrdem !== null && h.ordem > hierarquiaOrdem
  )

  const availableSuperiors = usuarios.filter((eu) => {
    if (!formHierarquiaId) return false
    const selectedH = hierarquias.find((h) => h.id === formHierarquiaId)
    if (!selectedH) return false
    const euH = eu.hierarquias as unknown as Hierarquia
    return euH && euH.ordem < selectedH.ordem
  })

  async function handleInvite() {
    if (!empresa || !usuario) return

    setSaving(true)
    try {
      // 1. Criar usuario no Supabase Auth usando client isolado
      const isolated = createIsolatedClient()
      const { data: authData, error: authError } = await isolated.auth.signUp({
        email: formEmail.toLowerCase(),
        password: '123456',
        options: {
          data: { nome: formNome },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Erro ao criar usuario')

      // 2. Vincular na tabela usuarios e empresa_usuarios
      const { error } = await supabase.rpc('convidar_usuario', {
        p_empresa_id: empresa.id,
        p_nome: formNome,
        p_email: formEmail.toLowerCase(),
        p_senha: '123456',
        p_telefone: formTelefone || null,
        p_hierarquia_id: formHierarquiaId,
        p_superior_id: formSuperiorId || null,
      })

      if (error) throw error

      toast({ title: 'Usuario criado com sucesso', description: `Email: ${formEmail} / Senha provisoria: 123456`, variant: 'success' })
      setDialogOpen(false)
      fetchUsuarios()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao convidar'
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
    const h = (eu.hierarquias || (eu as Record<string, unknown>).hierarquias) as unknown as Hierarquia
    if (hierarquiaOrdem !== null && h && h.ordem > hierarquiaOrdem) return true
    return false
  }

  function openEditDialog(eu: EmpresaUsuario) {
    const u = eu.usuario || (eu as Record<string, unknown>).usuarios as EmpresaUsuario['usuario']
    const h = (eu.hierarquias || (eu as Record<string, unknown>).hierarquias) as unknown as Hierarquia
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
      const u = editingUser.usuario || (editingUser as Record<string, unknown>).usuarios as EmpresaUsuario['usuario']

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
    const h = (eu.hierarquias || (eu as Record<string, unknown>).hierarquias) as unknown as Hierarquia
    if (hierarquiaOrdem !== null && h && h.ordem > hierarquiaOrdem) return true
    return false
  }

  async function handleDelete(eu: EmpresaUsuario) {
    const u = eu.usuario || (eu as Record<string, unknown>).usuarios as EmpresaUsuario['usuario']
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
    const u = eu.usuario || (eu as Record<string, unknown>).usuarios as EmpresaUsuario['usuario']
    if (!u) return false
    const q = search.toLowerCase()
    return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const totalAtivos = usuarios.filter(eu => eu.ativo).length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/20">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Usuarios</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Equipe e permissoes de acesso</p>
          </div>
        </div>
        {availableHierarquias.length > 0 && (
          <Button onClick={() => {
            setDialogOpen(true)
            setFormNome(''); setFormEmail(''); setFormTelefone('')
            setFormHierarquiaId(''); setFormSuperiorId('')
          }} className="gap-2 self-start">
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <Users className="h-5 w-5 text-cyan-400" />
          <div>
            <p className="text-lg font-bold text-cyan-300">{totalAtivos}</p>
            <p className="text-[11px] text-cyan-400/70 font-medium">Usuarios Ativos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <ShieldCheck className="h-5 w-5 text-blue-400" />
          <div>
            <p className="text-lg font-bold text-blue-300">{hierarquias.length}</p>
            <p className="text-[11px] text-blue-400/70 font-medium">Niveis de Hierarquia</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20 hidden sm:flex">
          <UserPlus className="h-5 w-5 text-violet-400" />
          <div>
            <p className="text-lg font-bold text-violet-300">{availableHierarquias.length}</p>
            <p className="text-[11px] text-violet-400/70 font-medium">Cargos Disponiveis</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
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
                  const u = eu.usuario || (eu as Record<string, unknown>).usuarios as EmpresaUsuario['usuario']
                  const h = (eu.hierarquias || (eu as Record<string, unknown>).hierarquias) as unknown as Hierarquia
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
                        <p className="text-sm font-medium text-muted-foreground">Nenhum usuario encontrado</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {search ? 'Tente ajustar sua busca' : 'Convide membros para a equipe'}
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
            <DialogTitle>Convidar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-xs text-blue-400">Senha provisoria: <span className="font-mono font-bold">123456</span></p>
              <p className="text-[11px] text-blue-400/60 mt-0.5">O usuario sera obrigado a redefinir no primeiro login</p>
            </div>
            <div className="space-y-2">
              <Label>Telefone (opcional)</Label>
              <Input value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Hierarquia</Label>
              <Select value={formHierarquiaId} onChange={(e) => setFormHierarquiaId(e.target.value)}>
                <option value="">Selecione...</option>
                {availableHierarquias.map((h) => (
                  <option key={h.id} value={h.id}>{h.nome}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Superior direto (opcional)</Label>
              <Select value={formSuperiorId} onChange={(e) => setFormSuperiorId(e.target.value)}>
                <option value="">Nenhum</option>
                {availableSuperiors.map((eu) => (
                  <option key={eu.id} value={eu.id}>{eu.usuario?.nome}</option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!formNome || !formEmail || !formHierarquiaId || saving}>
              {saving ? 'Criando...' : 'Criar Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog Editar Usuario */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent onClose={() => setEditDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            {editingUser && editingUser.usuario_id !== usuario?.id && (
              <>
                <div className="space-y-2">
                  <Label>Hierarquia</Label>
                  <Select value={editHierarquiaId} onChange={(e) => setEditHierarquiaId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {hierarquias.filter(h => hierarquiaOrdem !== null ? h.ordem >= hierarquiaOrdem : true).map((h) => (
                      <option key={h.id} value={h.id}>{h.nome}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Superior direto</Label>
                  <Select value={editSuperiorId} onChange={(e) => setEditSuperiorId(e.target.value)}>
                    <option value="">Nenhum</option>
                    {usuarios.filter((eu) => {
                      if (!editHierarquiaId) return false
                      const selectedH = hierarquias.find((h) => h.id === editHierarquiaId)
                      if (!selectedH) return false
                      const euH = (eu.hierarquias || (eu as Record<string, unknown>).hierarquias) as unknown as Hierarquia
                      return euH && euH.ordem < selectedH.ordem
                    }).map((eu) => {
                      const u = eu.usuario || (eu as Record<string, unknown>).usuarios as EmpresaUsuario['usuario']
                      return <option key={eu.id} value={eu.id}>{u?.nome}</option>
                    })}
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editNome || editSaving}>
              {editSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
