import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export default function CriarEmpresa() {
  const { usuario, isMaster } = useAuth()
  const { refreshEmpresas, setEmpresaId } = useEmpresa()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [gerenteNome, setGerenteNome] = useState('')
  const [gerenteEmail, setGerenteEmail] = useState('')
  const [gerenteSenha, setGerenteSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isMaster && gerenteEmail) {
        // Master criando empresa com gerente
        if (!gerenteSenha || gerenteSenha.length < 6) {
          setError('A senha do gerente deve ter pelo menos 6 caracteres')
          setLoading(false)
          return
        }

        const { data: empresaId, error: rpcError } = await supabase.rpc('criar_empresa_com_gerente', {
          p_nome: nome,
          p_cnpj: cnpj || null,
          p_master_id: usuario.id,
          p_gerente_email: gerenteEmail,
          p_gerente_senha: gerenteSenha,
          p_gerente_nome: gerenteNome || gerenteEmail.split('@')[0],
        })

        if (rpcError) throw rpcError

        setSuccess(`Empresa criada! Gerente: ${gerenteEmail} / Senha: ${gerenteSenha}`)
        await refreshEmpresas()
        setTimeout(() => {
          setEmpresaId(empresaId)
          navigate('/dashboard')
        }, 2000)
      } else {
        // Fluxo normal (master sem gerente ou usuario comum)
        const { data: empresaId, error: rpcError } = await supabase.rpc('criar_empresa_completa', {
          p_nome: nome,
          p_cnpj: cnpj || null,
          p_usuario_id: usuario.id,
        })

        if (rpcError) throw rpcError

        await refreshEmpresas()
        setEmpresaId(empresaId)
        navigate('/dashboard')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar empresa'
      if (message.includes('CNPJ')) {
        setError('Ja existe uma empresa cadastrada com este CNPJ.')
      } else if (message.includes('email')) {
        setError('Ja existe um usuario com este email.')
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
            onClick={() => navigate(isMaster ? '/master' : '/selecionar-empresa')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <CardTitle className="text-2xl">Criar Empresa</CardTitle>
          {isMaster && (
            <CardDescription>Vincule um gerente para administrar esta empresa</CardDescription>
          )}
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

            {isMaster && (
              <>
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-medium mb-3">Gerente da Empresa</h3>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Gerente</Label>
                  <Input
                    value={gerenteNome}
                    onChange={(e) => setGerenteNome(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email do Gerente</Label>
                  <Input
                    type="email"
                    value={gerenteEmail}
                    onChange={(e) => setGerenteEmail(e.target.value)}
                    placeholder="gerente@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha provisoria</Label>
                  <Input
                    type="text"
                    value={gerenteSenha}
                    onChange={(e) => setGerenteSenha(e.target.value)}
                    placeholder="Senha de acesso"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    O gerente pode alterar depois em Configuracoes
                  </p>
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Empresa'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
