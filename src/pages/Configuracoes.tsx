import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Settings, User, Lock, Mail, Phone, Save, Shield } from 'lucide-react'

export default function Configuracoes() {
  const { user, usuario } = useAuth()
  const { toast } = useToast()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [nomeEdit, setNomeEdit] = useState(usuario?.nome ?? '')
  const [telefoneEdit, setTelefoneEdit] = useState(usuario?.telefone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

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
      const { error } = await supabase.rpc('alterar_senha', {
        p_auth_id: user!.id,
        p_nova_senha: novaSenha,
      })

      if (error) throw error

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

  return (
    <div className="space-y-6 max-w-lg animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-lg shadow-slate-500/20">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Configuracoes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gerencie seu perfil e seguranca</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <User className="h-4 w-4 text-blue-400" />
            </div>
            Meu Perfil
          </CardTitle>
          <CardDescription>Atualize suas informacoes pessoais</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>
                <Mail className="h-3.5 w-3.5 text-zinc-500" />
                Email
              </Label>
              <Input value={usuario?.email ?? ''} disabled className="bg-white/[0.02] opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>
                <User className="h-3.5 w-3.5 text-zinc-500" />
                Nome
              </Label>
              <Input value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>
                <Phone className="h-3.5 w-3.5 text-zinc-500" />
                Telefone
              </Label>
              <Input value={telefoneEdit} onChange={(e) => setTelefoneEdit(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <Button type="submit" disabled={savingProfile} className="gap-2">
              <Save className="h-4 w-4" />
              {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            Alterar Senha
          </CardTitle>
          <CardDescription>Defina uma nova senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>
                <Lock className="h-3.5 w-3.5 text-zinc-500" />
                Nova senha
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
              <Label>
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
            <Button type="submit" disabled={loading} className="gap-2">
              <Lock className="h-4 w-4" />
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
