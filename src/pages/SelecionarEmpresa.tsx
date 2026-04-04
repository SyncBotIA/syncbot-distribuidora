import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, Plus, LogOut, Trash2, Settings, Package } from 'lucide-react'

export default function SelecionarEmpresa() {
  const { usuario, signOut, isMaster } = useAuth()
  const { empresas, setEmpresaId, refreshEmpresas, loading } = useEmpresa()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState<string | null>(null)

  function handleSelect(empresaId: string) {
    setEmpresaId(empresaId)
    navigate('/dashboard')
  }

  async function handleDelete(empresaId: string, empresaNome: string) {
    if (!usuario) return
    if (!confirm(`Tem certeza que deseja excluir a empresa "${empresaNome}"? Todos os dados serao apagados permanentemente.`)) return

    setDeleting(empresaId)
    try {
      const { error } = await supabase.rpc('deletar_empresa', {
        p_empresa_id: empresaId,
        p_usuario_id: usuario.id,
      })
      if (error) throw error
      await refreshEmpresas()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir empresa'
      alert(message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-slate-900">
        <p className="text-zinc-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-slate-900 p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-600 mb-4">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Selecionar Empresa</h1>
          <p className="text-zinc-400 mt-1">Escolha a empresa para acessar</p>
        </div>

        <Card className="shadow-2xl shadow-black/20 border-0">
          <CardContent className="p-6 space-y-3">
            {empresas.length === 0 && (
              <p className="text-center text-muted-foreground py-6">
                {isMaster
                  ? 'Nenhuma empresa cadastrada. Crie a primeira!'
                  : 'Voce ainda nao pertence a nenhuma empresa. Entre em contato com o administrador.'}
              </p>
            )}

            {empresas.map((emp) => (
              <div key={emp.id} className="flex items-center gap-2">
                <button
                  onClick={() => handleSelect(emp.id)}
                  className="flex-1 flex items-center gap-3 p-4 rounded-xl border hover:bg-accent hover:border-primary/20 transition-all duration-150 text-left cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{emp.nome}</p>
                    {emp.cnpj && <p className="text-sm text-muted-foreground">{emp.cnpj}</p>}
                  </div>
                </button>
                {isMaster && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.nome) }}
                    disabled={deleting === emp.id}
                    className="p-3 rounded-xl border text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                    title="Excluir empresa"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}

            <div className="flex flex-col gap-2 pt-4 border-t">
              {isMaster && (
                <Button onClick={() => navigate('/master')} className="w-full gap-2 h-11">
                  <Settings className="h-4 w-4" />
                  Painel Master
                </Button>
              )}
              <div className="flex gap-2">
                {isMaster && (
                  <Button onClick={() => navigate('/criar-empresa')} variant="outline" className="flex-1 gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Empresa
                  </Button>
                )}
                <Button variant="outline" onClick={signOut} className={isMaster ? 'gap-2' : 'flex-1 gap-2'}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
