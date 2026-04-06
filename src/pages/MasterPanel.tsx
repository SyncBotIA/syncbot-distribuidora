import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Building2, Plus, Trash2, UserPlus, Users, X, Pencil, Check } from 'lucide-react'

interface EmpresaResumo {
  id: string
  nome: string
  cnpj: string
  created_at: string
  total_usuarios: number
}

interface UsuarioEmpresa {
  eu_id: string
  usuario_id: string
  ativo: boolean
  usuario_nome: string
  usuario_email: string
  usuario_telefone: string | null
  hierarquia_id: string
  hierarquia_nome: string
  hierarquia_ordem: number
}

export default function MasterPanel() {
  const { usuario, isMaster } = useAuth()
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaResumo | null>(null)
  const [usuarios, setUsuários] = useState<UsuarioEmpresa[]>([])
  const [userCounts, setUserCounts] = useState<Record<string, number>>({})
  const [hierarquias, setHierarquias] = useState<{ id: string; nome: string; ordem: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [selectedHierarquiaId, setSelectedHierarquiaId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editHierarquiaId, setEditHierarquiaId] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fetchEmpresas = useCallback(async () => {
    if (!usuario) return
    const { data, error } = await supabase.rpc('listar_todas_empresas', {
      p_master_id: usuario.id,
    })
    if (!error && data) {
      const empresasList = data as EmpresaResumo[]
      setEmpresas(empresasList)

      // Buscar contagem real de usuarios validos por empresa
      const counts: Record<string, number> = {}
      await Promise.all(
        empresasList.map(async (emp) => {
          const { data: users } = await supabase.rpc('master_listar_usuarios_empresa', {
            p_empresa_id: emp.id,
          })
          if (users) {
            const valid = (users as unknown as UsuarioEmpresa[]).filter(u => u.usuario_id && u.ativo)
            counts[emp.id] = valid.length
          }
        })
      )
      setUserCounts(counts)
    }
    setLoading(false)
  }, [usuario])

  useEffect(() => {
    if (!isMaster) {
      navigate('/selecionar-empresa')
      return
    }
    fetchEmpresas()
  }, [isMaster, navigate, fetchEmpresas])

  async function fetchUsuáriosEmpresa(empresaId: string) {
    // Buscar usuarios
    const { data, error } = await supabase.rpc('master_listar_usuarios_empresa', {
      p_empresa_id: empresaId,
    })

    if (error) {
      console.error('Erro ao listar usuarios:', error)
    }

    if (data) {
      // Filtrar registros que possuem usuario valido e estao ativos (evitar orfaos)
      const valid = (data as unknown as UsuarioEmpresa[]).filter(u => u.usuario_id && u.ativo)
      setUsuários(valid)

      // Atualizar contagem real por empresa no frontend
      setUserCounts(prev => ({ ...prev, [empresaId]: valid.length }))
    }

    // Buscar TODAS as hierarquias da empresa (independente de quem esta cadastrado)
    const { data: hierData } = await supabase
      .from('hierarquias')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('ordem')

    setHierarquias((hierData || []).map(h => ({ id: h.id, nome: h.nome, ordem: h.ordem })))
  }

  function handleSelectEmpresa(emp: EmpresaResumo) {
    setSelectedEmpresa(emp)
    setShowAddForm(false)
    setError('')
    setSuccess('')
    fetchUsuáriosEmpresa(emp.id)
  }

  async function handleAddUsuario(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario || !selectedEmpresa) return

    setSaving(true)
    setError('')
    setSuccess('')

    const nomeUsuario = nome.trim() || email.trim().split('@')[0]
    const emailUsuario = email.trim().toLowerCase()

    try {
      // 1. Criar conta no Supabase Auth (com hash bcrypt correto)
      const { data: authData, error: authError } = await createIsolatedClient().auth.signUp({
        email: emailUsuario,
        password: '123456',
        options: { data: { nome: nomeUsuario } },
      })

      if (authError) throw authError
      if (!authData?.user) throw new Error('Erro ao criar usuario')

      // 2. Vincular a empresa via RPC
      const { error: linkError } = await supabase.rpc('convidar_usuario_com_auth_id', {
        p_empresa_id: selectedEmpresa.id,
        p_nome: nomeUsuario,
        p_email: emailUsuario,
        p_hierarquia_id: selectedHierarquiaId,
        p_telefone: null,
        p_superior_id: null,
        p_auth_id: authData.user.id,
      })

      if (linkError) throw linkError

      setSuccess(`Usuario criado! Email: ${emailUsuario} / Senha provisoria: 123456`)
      setNome('')
      setEmail('')
      setShowAddForm(false)
      fetchUsuáriosEmpresa(selectedEmpresa.id)
      fetchEmpresas()
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string }
      const message = e.details ?? e.hint ?? e.message ?? 'Erro ao adicionar usuario'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(eu: UsuarioEmpresa) {
    setEditingId(eu.eu_id)
    setEditNome(eu.usuario_nome)
    setEditEmail(eu.usuario_email)
    setEditHierarquiaId(eu.hierarquia_id)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditNome('')
    setEditEmail('')
    setEditHierarquiaId('')
  }

  async function handleSaveEdit(eu: UsuarioEmpresa) {
    setEditSaving(true)

    try {
      // Atualizar nome na tabela usuarios
      const { error: userError } = await supabase
        .from('usuarios')
        .update({ nome: editNome })
        .eq('id', eu.usuario_id)

      if (userError) throw userError

      // Atualizar hierarquia na empresa_usuarios
      if (editHierarquiaId && editHierarquiaId !== eu.hierarquia_id) {
        const { error: euError } = await supabase
          .from('empresa_usuarios')
          .update({ hierarquia_id: editHierarquiaId })
          .eq('id', eu.eu_id)

        if (euError) throw euError
      }

      cancelEdit()
      if (selectedEmpresa) fetchUsuáriosEmpresa(selectedEmpresa.id)
    } catch {
      setError('Erro ao salvar alteracoes')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleRemoveUsuario(euId: string, nomeUsuario: string) {
    if (!usuario) return
    if (!confirm(`Remover "${nomeUsuario}" desta empresa?`)) return

    try {
      const { error } = await supabase.rpc('desvincular_usuario_empresa', {
        p_master_id: usuario.id,
        p_empresa_usuario_id: euId,
      })
      if (error) throw error
      if (selectedEmpresa) {
        fetchUsuáriosEmpresa(selectedEmpresa.id)
        fetchEmpresas()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao remover'
      setError(message)
    }
  }

  async function handleDeleteEmpresa(empresa: EmpresaResumo) {
    if (!usuario) return
    if (!confirm(`Tem certeza que deseja excluir a empresa "${empresa.nome}"? Todos os dados serão apagados permanentemente.`)) return

    try {
      const { error } = await supabase.rpc('deletar_empresa', {
        p_empresa_id: empresa.id,
        p_usuario_id: usuario.id,
      })
      if (error) throw error
      if (selectedEmpresa?.id === empresa.id) {
        setSelectedEmpresa(null)
      }
      fetchEmpresas()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir empresa'
      setError(message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#0c1220] p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-800/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/selecionar-empresa')}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors p-2 rounded-lg hover:bg-white/[0.04]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Painel Master</h1>
              <p className="text-zinc-500 text-sm mt-0.5">Gerencie empresas e seus usuários</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Master
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Lista de Empresas */}
          <div className="lg:col-span-1">
            <Card className="shadow-2xl shadow-black/40 border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Building2 className="h-5 w-5 text-blue-400" />
                  Empresas ({empresas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {empresas.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectEmpresa(emp)}
                      className={`flex-1 text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                        selectedEmpresa?.id === emp.id
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500/50 shadow-lg shadow-blue-600/25'
                          : 'border-white/[0.06] hover:bg-white/[0.04] hover:border-blue-500/20'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${selectedEmpresa?.id === emp.id ? 'text-white' : 'text-zinc-200'}`}>{emp.nome}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-xs font-mono ${selectedEmpresa?.id === emp.id ? 'text-white/60' : 'text-zinc-500'}`}>
                          {emp.cnpj || 'Sem CNPJ'}
                        </span>
                        <span className={`text-xs flex items-center gap-1 ${selectedEmpresa?.id === emp.id ? 'text-white/60' : 'text-zinc-500'}`}>
                          <Users className="h-3 w-3" />
                          {userCounts[emp.id] ?? emp.total_usuarios}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEmpresa(emp) }}
                      className="flex-shrink-0 p-2.5 rounded-xl border border-white/[0.06] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/15 transition-all cursor-pointer"
                      title="Excluir empresa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {empresas.length === 0 && (
                  <div className="flex flex-col items-center py-8">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-3">
                      <Building2 className="h-5 w-5 text-zinc-600" />
                    </div>
                    <p className="text-center text-zinc-500 text-sm">
                      Nenhuma empresa cadastrada
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => navigate('/criar-empresa')}
                  variant="outline"
                  className="w-full gap-2 mt-2 border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  Nova Empresa
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Detalhes da Empresa */}
          <div className="lg:col-span-2">
            {!selectedEmpresa ? (
              <Card className="shadow-2xl shadow-black/40 border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <div className="h-14 w-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-4">
                    <Building2 className="h-7 w-7 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400 font-medium">Selecione uma empresa</p>
                  <p className="text-zinc-600 text-sm mt-1">Clique em uma empresa ao lado para gerenciar</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-2xl shadow-black/40 border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">{selectedEmpresa.nome}</CardTitle>
                      <CardDescription className="text-zinc-500 font-mono">{selectedEmpresa.cnpj || 'Sem CNPJ'}</CardDescription>
                    </div>
                    <Button
                      onClick={() => { setShowAddForm(true); setError(''); setSuccess('') }}
                      className="gap-2"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      Adicionar Usuário
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Form adicionar */}
                  {showAddForm && (
                    <div className="border border-white/[0.08] rounded-xl p-4 bg-white/[0.02] space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-zinc-200 text-sm">Adicionar Usuário</h3>
                        <button onClick={() => setShowAddForm(false)} className="cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <form onSubmit={handleAddUsuario} className="space-y-3">
                        <div>
                          <Label className="text-zinc-400 text-xs">Nome</Label>
                          <Input
                            placeholder="Nome completo"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <Label className="text-zinc-400 text-xs">Email</Label>
                          <Input
                            type="email"
                            placeholder="email@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <Label className="text-zinc-400 text-xs">Cargo</Label>
                          <select
                            value={selectedHierarquiaId}
                            onChange={(e) => setSelectedHierarquiaId(e.target.value)}
                            className="w-full h-10 rounded-xl border border-white/[0.08] bg-[#0c1225] px-3 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 [&>option]:bg-[#0c1225] [&>option]:text-white"
                            required
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value="">Selecione...</option>
                            {hierarquias.map((h) => (
                              <option key={h.id} value={h.id}>{h.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
                          <p className="text-xs text-blue-400">Senha provisória: <span className="font-mono font-bold">123456</span></p>
                          <p className="text-[11px] text-blue-400/60 mt-0.5">O usuário será obrigado a redefinir no primeiro login</p>
                        </div>

                        {error && (
                          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                            <p className="text-sm text-red-400">{error}</p>
                          </div>
                        )}
                        {success && (
                          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                            <p className="text-sm text-emerald-400">{success}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button type="submit" disabled={saving || !selectedHierarquiaId} size="sm">
                            {saving ? 'Criando...' : 'Criar Usuário'}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)} className="border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:text-white">
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Lista de usuarios */}
                  <div>
                    <h3 className="font-medium text-sm mb-3 flex items-center gap-2 text-zinc-300">
                      <Users className="h-4 w-4 text-blue-400" />
                      Usuários ({usuarios.length})
                    </h3>

                    {usuarios.length === 0 ? (
                      <div className="flex flex-col items-center py-8">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-3">
                          <Users className="h-5 w-5 text-zinc-600" />
                        </div>
                        <p className="text-sm text-zinc-500 text-center">
                          Nenhum usuário vinculado
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {usuarios.map((eu) => (
                          <div
                            key={eu.eu_id}
                            className="p-3.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                          >
                            {editingId === eu.eu_id ? (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-zinc-400 text-xs">Nome</Label>
                                  <Input
                                    value={editNome}
                                    onChange={(e) => setEditNome(e.target.value)}
                                    className="bg-white/[0.06] border-white/[0.08] text-white h-9 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-zinc-400 text-xs">Cargo</Label>
                                  <select
                                    value={editHierarquiaId}
                                    onChange={(e) => setEditHierarquiaId(e.target.value)}
                                    className="w-full h-9 rounded-xl border border-white/[0.08] bg-[#0c1225] px-3 text-sm text-white appearance-none cursor-pointer [&>option]:bg-[#0c1225] [&>option]:text-white"
                                    style={{ colorScheme: 'dark' }}
                                  >
                                    {hierarquias.map((h) => (
                                      <option key={h.id} value={h.id}>{h.nome}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(eu)}
                                    disabled={editSaving || !editNome}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    {editSaving ? 'Salvando...' : 'Salvar'}
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm text-zinc-200">{eu.usuario_nome}</p>
                                  <p className="text-xs text-zinc-500">{eu.usuario_email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={eu.hierarquia_ordem === 1 ? 'default' : 'secondary'}
                                    className={eu.hierarquia_ordem === 1 ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' : 'bg-white/[0.05] text-zinc-400 border-white/[0.08]'}
                                  >
                                    {eu.hierarquia_nome}
                                  </Badge>
                                  <button
                                    onClick={() => startEdit(eu)}
                                    className="p-2 rounded-lg text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                    title="Editar usuario"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveUsuario(eu.eu_id, eu.usuario_nome)}
                                    className="p-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title="Remover da empresa"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
