import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Building2, Plus, LogOut, Trash2, Settings, Package, ArrowRight, Sparkles } from 'lucide-react'

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
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
          <p className="text-zinc-500 text-sm font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-blue-600/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-indigo-700/6 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-flex">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-5">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Selecionar Empresa</h1>
          <p className="text-zinc-500 mt-1.5 text-sm">Escolha a empresa para acessar</p>
        </div>

        <Card className="shadow-2xl shadow-black/50 border-white/[0.06] backdrop-blur-xl">
          <CardContent className="p-6 space-y-3">
            {empresas.length === 0 && (
              <div className="text-center py-10">
                <div className="h-14 w-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-7 w-7 text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm">
                  {isMaster
                    ? 'Nenhuma empresa cadastrada. Crie a primeira!'
                    : 'Voce ainda nao pertence a nenhuma empresa.'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {empresas.map((emp, i) => (
                <div key={emp.id} className="flex items-center gap-2" style={{ animationDelay: `${i * 0.05}s` }}>
                  <button
                    onClick={() => handleSelect(emp.id)}
                    className="flex-1 flex items-center gap-3.5 p-4 rounded-xl border border-white/[0.06] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200 text-left cursor-pointer group"
                  >
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 flex items-center justify-center group-hover:from-blue-500/25 group-hover:to-blue-600/15 transition-all border border-blue-500/10">
                      <Building2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{emp.nome}</p>
                      {emp.cnpj && <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{emp.cnpj}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                  </button>
                  {isMaster && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.nome) }}
                      disabled={deleting === emp.id}
                      className="p-3 rounded-xl border border-white/[0.06] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/15 transition-all cursor-pointer disabled:opacity-50"
                      title="Excluir empresa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.06]">
              {isMaster && (
                <Link to="/master" className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-600/20 cursor-pointer transition-all active:scale-[0.98] border border-blue-500/20">
                  <Settings className="h-4 w-4" />
                  Painel Master
                </Link>
              )}
              <div className="flex gap-2">
                {isMaster && (
                  <Button onClick={() => navigate('/criar-empresa')} variant="outline" className="flex-1 gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Empresa
                  </Button>
                )}
                <Button variant="outline" onClick={signOut} className={`gap-2 ${isMaster ? '' : 'flex-1'}`}>
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
