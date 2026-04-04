import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Building2, Plus, Trash2, UserPlus, Users, X } from 'lucide-react'

interface EmpresaResumo {
  id: string
  nome: string
  cnpj: string
  created_at: string
  total_usuarios: number
}

interface UsuarioEmpresa {
  id: string
  usuario_id: string
  ativo: boolean
  usuario: { id: string; nome: string; email: string }
  hierarquia: { id: string; nome: string; ordem: number }
}

export default function MasterPanel() {
  const { usuario, isMaster } = useAuth()
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([])
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaResumo | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
  const [hierarquias, setHierarquias] = useState<{ id: string; nome: string; ordem: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [email, setEmail] = useState('')
  const [selectedOrdem, setSelectedOrdem] = useState(2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchEmpresas = useCallback(async () => {
    if (!usuario) return
    const { data, error } = await supabase.rpc('listar_todas_empresas', {
      p_master_id: usuario.id,
    })
    if (!error && data) {
      setEmpresas(data as EmpresaResumo[])
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

  async function fetchUsuariosEmpresa(empresaId: string) {
    const { data } = await supabase
      .from('empresa_usuarios')
      .select('id, usuario_id, ativo, usuarios(id, nome, email), hierarquias(id, nome, ordem)')
      .eq('empresa_id', empresaId)
      .order('created_at')

    if (data) {
      setUsuarios(data as unknown as UsuarioEmpresa[])
    }

    const { data: hierData } = await supabase
      .from('hierarquias')
      .select('id, nome, ordem')
      .eq('empresa_id', empresaId)
      .order('ordem')

    if (hierData) {
      setHierarquias(hierData)
    }
  }

  function handleSelectEmpresa(emp: EmpresaResumo) {
    setSelectedEmpresa(emp)
    setShowAddForm(false)
    setError('')
    setSuccess('')
    fetchUsuariosEmpresa(emp.id)
  }

  async function handleAddUsuario(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario || !selectedEmpresa) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase.rpc('vincular_usuario_empresa', {
        p_master_id: usuario.id,
        p_email: email.trim(),
        p_empresa_id: selectedEmpresa.id,
        p_hierarquia_ordem: selectedOrdem,
      })

      if (error) throw error

      setSuccess(data as string)
      setEmail('')
      setShowAddForm(false)
      fetchUsuariosEmpresa(selectedEmpresa.id)
      fetchEmpresas()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao vincular usuário'
      setError(message)
    } finally {
      setSaving(false)
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
        fetchUsuariosEmpresa(selectedEmpresa.id)
        fetchEmpresas()
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
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
              <p className="text-zinc-500 text-sm mt-0.5">Gerencie empresas e seus usuarios</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Master
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <button
                    key={emp.id}
                    onClick={() => handleSelectEmpresa(emp)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
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
                        {emp.total_usuarios}
                      </span>
                    </div>
                  </button>
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
                      Adicionar Usuario
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Form adicionar */}
                  {showAddForm && (
                    <div className="border border-white/[0.08] rounded-xl p-4 bg-white/[0.02] space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-zinc-200 text-sm">Vincular Usuario</h3>
                        <button onClick={() => setShowAddForm(false)} className="cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <form onSubmit={handleAddUsuario} className="space-y-3">
                        <div>
                          <Label className="text-zinc-400 text-xs">Email do usuario</Label>
                          <Input
                            type="email"
                            placeholder="email@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                          />
                          <p className="text-[11px] text-zinc-600 mt-1">
                            O usuario precisa ter criado uma conta antes
                          </p>
                        </div>
                        <div>
                          <Label className="text-zinc-400 text-xs">Cargo</Label>
                          <select
                            value={selectedOrdem}
                            onChange={(e) => setSelectedOrdem(Number(e.target.value))}
                            className="w-full h-10 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-white"
                          >
                            {hierarquias.map((h) => (
                              <option key={h.id} value={h.ordem}>{h.nome}</option>
                            ))}
                          </select>
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
                          <Button type="submit" disabled={saving} size="sm">
                            {saving ? 'Vinculando...' : 'Vincular'}
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
                      Usuarios ({usuarios.length})
                    </h3>

                    {usuarios.length === 0 ? (
                      <div className="flex flex-col items-center py-8">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-3">
                          <Users className="h-5 w-5 text-zinc-600" />
                        </div>
                        <p className="text-sm text-zinc-500 text-center">
                          Nenhum usuario vinculado
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {usuarios.map((eu) => (
                          <div
                            key={eu.id}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                          >
                            <div>
                              <p className="font-medium text-sm text-zinc-200">{eu.usuario?.nome || 'Sem nome'}</p>
                              <p className="text-xs text-zinc-500">{eu.usuario?.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={eu.hierarquia?.ordem === 1 ? 'default' : 'secondary'}
                                className={eu.hierarquia?.ordem === 1 ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' : 'bg-white/[0.05] text-zinc-400 border-white/[0.08]'}
                              >
                                {eu.hierarquia?.nome || 'Sem cargo'}
                              </Badge>
                              <button
                                onClick={() => handleRemoveUsuario(eu.id, eu.usuario?.nome || '')}
                                className="p-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Remover da empresa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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
