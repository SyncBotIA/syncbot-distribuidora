import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Building2, Plus, LogOut, Trash2, Settings, Package, ArrowRight } from 'lucide-react'

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#0c1220]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#0c1220] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mb-5 shadow-xl shadow-blue-500/25">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Selecionar Empresa</h1>
          <p className="text-zinc-500 mt-1.5 text-sm">Escolha a empresa para acessar</p>
        </div>

        <Card className="shadow-2xl shadow-black/40 border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
          <CardContent className="p-6 space-y-3">
            {empresas.length === 0 && (
              <p className="text-center text-zinc-500 py-8 text-sm">
                {isMaster
                  ? 'Nenhuma empresa cadastrada. Crie a primeira!'
                  : 'Voce ainda nao pertence a nenhuma empresa. Entre em contato com o administrador.'}
              </p>
            )}

            {empresas.map((emp) => (
              <div key={emp.id} className="flex items-center gap-2">
                <button
                  onClick={() => handleSelect(emp.id)}
                  className="flex-1 flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all duration-200 text-left cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{emp.nome}</p>
                    {emp.cnpj && <p className="text-xs text-zinc-500 font-mono mt-0.5">{emp.cnpj}</p>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </button>
                {isMaster && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.nome) }}
                    disabled={deleting === emp.id}
                    className="p-3 rounded-xl border border-white/[0.06] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                    title="Excluir empresa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.06]">
              {isMaster && (
                <Link to="/master" className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Painel Master
                </Link>
              )}
              <div className="flex gap-2">
                {isMaster && (
                  <Button onClick={() => navigate('/criar-empresa')} variant="outline" className="flex-1 gap-2 border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:text-white">
                    <Plus className="h-4 w-4" />
                    Criar Empresa
                  </Button>
                )}
                <Button variant="outline" onClick={signOut} className={`gap-2 border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:text-white ${isMaster ? '' : 'flex-1'}`}>
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
