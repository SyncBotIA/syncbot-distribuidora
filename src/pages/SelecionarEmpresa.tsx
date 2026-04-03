import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Plus, LogOut, Trash2, Settings } from 'lucide-react'

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
    if (!confirm(`Tem certeza que deseja excluir a empresa "${empresaNome}"? Todos os dados serão apagados permanentemente.`)) return

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Selecionar Empresa</CardTitle>
          <CardDescription>Escolha a empresa para acessar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {empresas.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {isMaster
                ? 'Nenhuma empresa cadastrada. Crie a primeira!'
                : 'Você ainda não pertence a nenhuma empresa. Entre em contato com o administrador.'}
            </p>
          )}

          {empresas.map((emp) => (
            <div key={emp.id} className="flex items-center gap-2">
              <button
                onClick={() => handleSelect(emp.id)}
                className="flex-1 flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors text-left cursor-pointer"
              >
                <Building2 className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-medium">{emp.nome}</p>
                  {emp.cnpj && <p className="text-sm text-muted-foreground">{emp.cnpj}</p>}
                </div>
              </button>
              {isMaster && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.nome) }}
                  disabled={deleting === emp.id}
                  className="p-3 rounded-lg border text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                  title="Excluir empresa"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-4">
            {isMaster && (
              <Button onClick={() => navigate('/master')} className="w-full gap-2">
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
  )
}
