import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export default function CriarEmpresa() {
  const { usuario } = useAuth()
  const { refreshEmpresas, setEmpresaId } = useEmpresa()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setError('')
    setLoading(true)

    try {
      // Usar função RPC que cria tudo de uma vez (bypassa RLS)
      const { data: empresaId, error: rpcError } = await supabase.rpc('criar_empresa_completa', {
        p_nome: nome,
        p_cnpj: cnpj || null,
        p_usuario_id: usuario.id,
      })

      if (rpcError) throw rpcError

      await refreshEmpresas()
      setEmpresaId(empresaId)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar empresa'
      if (message.includes('CNPJ')) {
        setError('Já existe uma empresa cadastrada com este CNPJ.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <button
            onClick={() => navigate('/selecionar-empresa')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <CardTitle className="text-2xl">Criar Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Empresa</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da empresa"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ (opcional)</Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Empresa'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
