import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase, createIsolatedClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Loader2, Package } from 'lucide-react'

export default function CriarEmpresa() {
  const { usuario, isMaster } = useAuth()
  const { refreshEmpresas, setEmpresaId } = useEmpresa()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [gerenteNome, setGerenteNome] = useState('')
  const [gerenteEmail, setGerenteEmail] = useState('')
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
        toast({ title: 'CNPJ não encontrado', description: 'Verifique o número e tente novamente', variant: 'destructive' })
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
        // 1. Criar usuario do gerente no Supabase Auth
        const isolated = createIsolatedClient()
        const { error: authError } = await isolated.auth.signUp({
          email: gerenteEmail.toLowerCase(),
          password: '123456',
          options: {
            data: { nome: gerenteNome || gerenteEmail.split('@')[0] },
          },
        })

        if (authError && !authError.message.includes('already registered')) throw authError

        // 2. Criar empresa com gerente via RPC
        const { data: empresaId, error: rpcError } = await supabase.rpc('criar_empresa_com_gerente', {
          p_nome: nome,
          p_cnpj: cnpj.replace(/\D/g, '') || null,
          p_master_id: usuario.id,
          p_gerente_email: gerenteEmail.toLowerCase(),
          p_gerente_senha: '123456',
          p_gerente_nome: gerenteNome || gerenteEmail.split('@')[0],
        })

        if (rpcError) throw rpcError

        setSuccess(`Empresa criada! Gerente: ${gerenteEmail} / Senha provisória: 123456`)
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
        setError('Já existe uma empresa cadastrada com este CNPJ.')
      } else if (message.includes('email')) {
        setError('Já existe um usuário com este email.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#0c1220] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl shadow-black/40 border-white/[0.06] bg-white/[0.03] backdrop-blur-xl relative z-10 animate-fade-in">
        <CardHeader>
          <button
            onClick={() => navigate(isMaster ? '/master' : '/selecionar-empresa')}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-3 cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Criar Empresa</CardTitle>
              {isMaster && (
                <CardDescription className="text-zinc-500">Vincule um gerente para administrar</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj" className="text-zinc-400 text-xs font-medium">CNPJ *</Label>
              <div className="relative">
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                />
                {buscandoCnpj && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-600">Digite o CNPJ para preencher o nome automaticamente</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-zinc-400 text-xs font-medium">Nome da Empresa</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da empresa"
                required
                className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
              />
            </div>

            {isMaster && (
              <>
                <div className="border-t border-white/[0.06] pt-4 mt-4">
                  <h3 className="font-medium text-sm text-zinc-300 mb-3">Gerente da Empresa</h3>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-xs font-medium">Nome do Gerente</Label>
                  <Input
                    value={gerenteNome}
                    onChange={(e) => setGerenteNome(e.target.value)}
                    placeholder="Nome completo"
                    className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-xs font-medium">Email do Gerente</Label>
                  <Input
                    type="email"
                    value={gerenteEmail}
                    onChange={(e) => setGerenteEmail(e.target.value)}
                    placeholder="gerente@email.com"
                    required
                    className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                  />
                </div>
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
                  <p className="text-xs text-blue-400">Senha provisória: <span className="font-mono font-bold">123456</span></p>
                  <p className="text-[11px] text-blue-400/60 mt-0.5">O gerente será obrigado a redefinir no primeiro login</p>
                </div>
              </>
            )}

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

            <Button type="submit" className="w-full h-11" disabled={loading || cnpj.replace(/\D/g, '').length !== 14}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando...
                </div>
              ) : 'Criar Empresa'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
