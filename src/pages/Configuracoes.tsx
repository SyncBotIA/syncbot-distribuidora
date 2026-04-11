import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import { cadastrarEmpresa } from '@/lib/nuvemfiscal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Settings, User, Lock, Mail, Phone, Save, Shield, PencilLine, Receipt, Loader2, CheckCircle } from 'lucide-react'

export default function Configuracoes() {
  const { user, usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { isAdmin, isMaster } = usePermissions()
  const { toast } = useToast()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [nomeEdit, setNomeEdit] = useState(usuario?.nome ?? '')
  const [telefoneEdit, setTelefoneEdit] = useState(usuario?.telefone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [cadastrandoNF, setCadastrandoNF] = useState(false)
  const [nfCadastrada, setNfCadastrada] = useState(false)

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (novaSenha.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }
    if (novaSenha !== confirmarSenha) {
      toast({ title: 'Erro', description: 'As senhas nao coincidem', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: novaSenha,
      })
      if (authError) throw authError

      // Reset provisional flag if it was set
      if (usuario) {
        await supabase
          .from('usuarios')
          .update({ senha_provisoria: false })
          .eq('id', usuario.id)
      }

      toast({ title: 'Senha alterada com sucesso', variant: 'success' })
      setNovaSenha('')
      setConfirmarSenha('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar senha'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return

    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ nome: nomeEdit, telefone: telefoneEdit || null })
        .eq('id', usuario.id)

      if (error) throw error
      toast({ title: 'Perfil atualizado', variant: 'success' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  // Get initials for the avatar
  const initials = usuario?.nome
    ? usuario.nome
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : (usuario?.email?.[0] ?? 'U').toUpperCase()

  return (
    <div className="space-y-5 animate-fade-in max-w-lg mx-auto sm:mx-0 sm:max-w-xl">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/20">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Configuracoes</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Gerencie seu perfil e seguranca</p>
        </div>
      </div>

      {/* Profile Avatar Section */}
      <div className="flex flex-col items-center text-center space-y-3 pb-2">
        <div className="relative">
          {/* Outer glow ring */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-400/20 blur-sm" />
          {/* Avatar circle */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/30 ring-2 ring-white/10">
            <span className="text-2xl sm:text-3xl font-bold text-white tracking-wide drop-shadow-lg">
              {initials}
            </span>
          </div>
          {/* Edit badge */}
          <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center shadow-lg">
            <PencilLine className="h-3 w-3 text-zinc-400" />
          </div>
        </div>
        <div>
          <p className="text-base font-semibold text-white">{usuario?.nome ?? 'Usuario'}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{usuario?.email ?? ''}</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="border-white/[0.06] overflow-hidden">
        {/* Card accent line */}
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-blue-500/10 to-transparent" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <div className="p-1.5 rounded-lg bg-blue-500/10 ring-1 ring-blue-400/10">
              <User className="h-4 w-4 text-blue-400" />
            </div>
            Meu Perfil
          </CardTitle>
          <CardDescription className="text-xs">Atualize suas informacoes pessoais</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Email — disabled with distinct styling */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-400">
                <Mail className="h-3.5 w-3.5" />
                Email
              </Label>
              <Input
                value={usuario?.email ?? ''}
                disabled
                className="bg-white/[0.02] opacity-50 cursor-not-allowed border-dashed"
              />
            </div>
            {/* Nome */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-zinc-500" />
                Nome
              </Label>
              <Input value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} required />
            </div>
            {/* Telefone */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-zinc-500" />
                Telefone
              </Label>
              <PhoneInput
                value={telefoneEdit}
                onChange={(v) => setTelefoneEdit(v)}
              />
            </div>
            <Button type="submit" disabled={savingProfile} className="gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-transform">
              <Save className="h-4 w-4" />
              {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* NF-e Card — Admin/Master only */}
      {(isAdmin || isMaster) && (
        <Card className="border-white/[0.06] overflow-hidden">
          <div className="h-px bg-gradient-to-r from-violet-500/40 via-violet-500/10 to-transparent" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="p-1.5 rounded-lg bg-violet-500/10 ring-1 ring-violet-400/10">
                <Receipt className="h-4 w-4 text-violet-400" />
              </div>
              Nota Fiscal Eletronica
            </CardTitle>
            <CardDescription className="text-xs">Cadastre sua empresa na Nuvem Fiscal para emitir NF-e</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nfCadastrada ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-emerald-300">Empresa cadastrada na Nuvem Fiscal com sucesso!</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-zinc-400">
                  Ao cadastrar, sua empresa podera emitir NF-e diretamente pela tela de Pedidos.
                  O cadastro usa o CNPJ da empresa e o ambiente de homologacao (testes).
                </p>
                <Button
                  onClick={async () => {
                    if (!empresa) return
                    setCadastrandoNF(true)
                    try {
                      const cnpj = empresa.cnpj?.replace(/\D/g, '')
                      if (!cnpj) {
                        toast({ title: 'CNPJ não cadastrado', description: 'Cadastre o CNPJ da empresa antes.', variant: 'destructive' })
                        setCadastrandoNF(false)
                        return
                      }
                      await cadastrarEmpresa({
                        cnpj,
                        razao_social: empresa.nome,
                        nome_fantasia: empresa.nome,
                        inscricao_estadual: '9999999999',
                        endereco: {
                          logradouro: 'Rua Teste',
                          numero: '100',
                          bairro: 'Centro',
                          codigo_municipio: '4106902',
                          nome_municipio: 'Curitiba',
                          uf: 'PR',
                          cep: '80000000',
                        },
                      })
                      setNfCadastrada(true)
                      toast({ title: 'Empresa cadastrada na Nuvem Fiscal', variant: 'success' })
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : 'Erro ao cadastrar'
                      if (message.includes('already') || message.includes('ja existe') || message.includes('409')) {
                        setNfCadastrada(true)
                        toast({ title: 'Empresa ja estava cadastrada', variant: 'success' })
                      } else {
                        toast({ title: 'Erro ao cadastrar na Nuvem Fiscal', description: message, variant: 'destructive' })
                      }
                    } finally {
                      setCadastrandoNF(false)
                    }
                  }}
                  disabled={cadastrandoNF}
                  className="gap-2 bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-500/15 active:scale-[0.98] transition-transform"
                >
                  {cadastrandoNF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  {cadastrandoNF ? 'Cadastrando...' : 'Cadastrar na Nuvem Fiscal'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Password Card */}
      <Card className="border-white/[0.06] overflow-hidden">
        {/* Card accent line */}
        <div className="h-px bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <div className="p-1.5 rounded-lg bg-amber-500/10 ring-1 ring-amber-400/10">
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            Alterar Senha
          </CardTitle>
          <CardDescription className="text-xs">Defina uma nova senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-zinc-500" />
                Nova Senha
              </Label>
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Minimo 6 caracteres"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-zinc-500" />
                Confirmar senha
              </Label>
              <Input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="gap-2 shadow-lg shadow-amber-500/15 active:scale-[0.98] transition-transform">
              <Shield className="h-4 w-4" />
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
