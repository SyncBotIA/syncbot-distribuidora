import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react'

export default function RedefinirSenha() {
  const { user, usuario, clearPasswordReset, signOut } = useAuth()
  const navigate = useNavigate()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (novaSenha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (novaSenha === '123456') {
      setError('Escolha uma senha diferente da provisoria')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas nao coincidem')
      return
    }

    setLoading(true)
    try {
      // Alterar senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: novaSenha,
      })
      if (authError) throw authError

      // Marcar senha_provisoria como false
      if (usuario) {
        const { error: dbError } = await supabase
          .from('usuarios')
          .update({ senha_provisoria: false })
          .eq('id', usuario.id)
        if (dbError) throw dbError
      }

      clearPasswordReset()
      navigate('/selecionar-empresa')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar senha'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#0c1220] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 mb-5 shadow-xl shadow-amber-500/25">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Redefinir Senha</h1>
          <p className="text-zinc-500 mt-1.5 text-sm">Sua senha e provisoria e precisa ser alterada</p>
        </div>

        {/* Alert */}
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Senha provisoria detectada</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Por seguranca, voce precisa criar uma nova senha antes de acessar o sistema. A nova senha deve ser diferente de "123456".
            </p>
          </div>
        </div>

        <Card className="shadow-2xl shadow-black/40 border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-400 text-xs font-medium">Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Minimo 6 caracteres"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-400 text-xs font-medium">Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Alterando...
                  </div>
                ) : 'Definir Nova Senha'}
              </Button>

              <button
                type="button"
                onClick={signOut}
                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors pt-2"
              >
                Sair da conta
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
