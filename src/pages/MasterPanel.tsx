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
    <div className="min-h-screen bg-muted p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/selecionar-empresa')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Painel Master</h1>
              <p className="text-muted-foreground text-sm">Gerencie empresas e seus usuários</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Master
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Empresas */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Empresas ({empresas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {empresas.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleSelectEmpresa(emp)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedEmpresa?.id === emp.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <p className="font-medium">{emp.nome}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs ${selectedEmpresa?.id === emp.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {emp.cnpj || 'Sem CNPJ'}
                      </span>
                      <span className={`text-xs flex items-center gap-1 ${selectedEmpresa?.id === emp.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        <Users className="h-3 w-3" />
                        {emp.total_usuarios}
                      </span>
                    </div>
                  </button>
                ))}

                {empresas.length === 0 && (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Nenhuma empresa cadastrada
                  </p>
                )}

                <Button
                  onClick={() => navigate('/criar-empresa')}
                  variant="outline"
                  className="w-full gap-2 mt-2"
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
              <Card>
                <CardContent className="flex items-center justify-center py-20">
                  <p className="text-muted-foreground">Selecione uma empresa para gerenciar</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedEmpresa.nome}</CardTitle>
                      <CardDescription>{selectedEmpresa.cnpj || 'Sem CNPJ'}</CardDescription>
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
                    <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Vincular Usuário</h3>
                        <button onClick={() => setShowAddForm(false)} className="cursor-pointer">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <form onSubmit={handleAddUsuario} className="space-y-3">
                        <div>
                          <Label>Email do usuário</Label>
                          <Input
                            type="email"
                            placeholder="email@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            O usuário precisa ter criado uma conta antes
                          </p>
                        </div>
                        <div>
                          <Label>Cargo</Label>
                          <select
                            value={selectedOrdem}
                            onChange={(e) => setSelectedOrdem(Number(e.target.value))}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {hierarquias.map((h) => (
                              <option key={h.id} value={h.ordem}>{h.nome}</option>
                            ))}
                          </select>
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}
                        {success && <p className="text-sm text-green-600">{success}</p>}

                        <div className="flex gap-2">
                          <Button type="submit" disabled={saving} size="sm">
                            {saving ? 'Vinculando...' : 'Vincular'}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Lista de usuários */}
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Usuários ({usuarios.length})
                    </h3>

                    {usuarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhum usuário vinculado
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {usuarios.map((eu) => (
                          <div
                            key={eu.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div>
                              <p className="font-medium">{eu.usuario?.nome || 'Sem nome'}</p>
                              <p className="text-sm text-muted-foreground">{eu.usuario?.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={eu.hierarquia?.ordem === 1 ? 'default' : 'secondary'}
                              >
                                {eu.hierarquia?.nome || 'Sem cargo'}
                              </Badge>
                              <button
                                onClick={() => handleRemoveUsuario(eu.id, eu.usuario?.nome || '')}
                                className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
