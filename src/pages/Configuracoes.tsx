import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

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
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Configuracoes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
          <CardDescription>Atualize suas informacoes pessoais</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={usuario?.email ?? ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={telefoneEdit} onChange={(e) => setTelefoneEdit(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>Defina uma nova senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Minimo 6 caracteres"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
