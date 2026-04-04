import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function CriarEmpresa() {
  const { usuario, isMaster } = useAuth()
  const { refreshEmpresas, setEmpresaId } = useEmpresa()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [gerenteNome, setGerenteNome] = useState('')
  const [gerenteEmail, setGerenteEmail] = useState('')
  const [gerenteSenha, setGerenteSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  async function buscarCnpj(cnpjRaw: string) {
    const digits = cnpjRaw.replace(/\D/g, '')
    if (digits.length !== 14) return

    setBuscandoCnpj(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!res.ok) {
        toast({ title: 'CNPJ nao encontrado', description: 'Verifique o numero e tente novamente', variant: 'destructive' })
        setBuscandoCnpj(false)
        return
      }
      const data = await res.json()
      setNome(data.razao_social || data.nome_fantasia || nome)
      toast({ title: 'Dados preenchidos', description: `${data.razao_social || data.nome_fantasia}`, variant: 'success' })
    } catch {
      toast({ title: 'Erro ao buscar CNPJ', description: 'Tente novamente', variant: 'destructive' })
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function handleCnpjChange(value: string) {
    const formatted = formatCnpj(value)
    setCnpj(formatted)

    const digits = value.replace(/\D/g, '')
    if (digits.length === 14) {
      buscarCnpj(digits)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isMaster && gerenteEmail) {
        if (!gerenteSenha || gerenteSenha.length < 6) {
          setError('A senha do gerente deve ter pelo menos 6 caracteres')
          setLoading(false)
          return
        }

        const { data: empresaId, error: rpcError } = await supabase.rpc('criar_empresa_com_gerente', {
          p_nome: nome,
          p_cnpj: cnpj.replace(/\D/g, '') || null,
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
        const { data: empresaId, error: rpcError } = await supabase.rpc('criar_empresa_completa', {
          p_nome: nome,
          p_cnpj: cnpj.replace(/\D/g, '') || null,
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl shadow-black/20 border-0">
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
              <Label htmlFor="cnpj">CNPJ *</Label>
              <div className="relative">
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                {buscandoCnpj && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Digite o CNPJ para preencher o nome automaticamente</p>
            </div>
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

            <Button type="submit" className="w-full h-11" disabled={loading || cnpj.replace(/\D/g, '').length !== 14}>
              {loading ? 'Criando...' : 'Criar Empresa'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
