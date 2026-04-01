import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Plus, LogOut } from 'lucide-react'

export default function SelecionarEmpresa() {
  const { signOut } = useAuth()
  const { empresas, setEmpresaId, loading } = useEmpresa()
  const navigate = useNavigate()

  function handleSelect(empresaId: string) {
    setEmpresaId(empresaId)
    navigate('/dashboard')
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
              Você ainda não pertence a nenhuma empresa.
            </p>
          )}

          {empresas.map((emp) => (
            <button
              key={emp.id}
              onClick={() => handleSelect(emp.id)}
              className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors text-left cursor-pointer"
            >
              <Building2 className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-medium">{emp.nome}</p>
                {emp.cnpj && <p className="text-sm text-muted-foreground">{emp.cnpj}</p>}
              </div>
            </button>
          ))}

          <div className="flex gap-2 pt-4">
            <Button onClick={() => navigate('/criar-empresa')} className="flex-1 gap-2">
              <Plus className="h-4 w-4" />
              Criar Empresa
            </Button>
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
