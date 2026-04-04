import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, Eye, EyeOff, AlertTriangle, Lock } from 'lucide-react'

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
      const { error: authError } = await supabase.auth.updateUser({
        password: novaSenha,
      })
      if (authError) throw authError

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
    <div className="min-h-screen flex items-center justify-center bg-[#030712] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-amber-600/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-700/5 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/25 mb-5">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
              <Lock className="h-3 w-3 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Redefinir Senha</h1>
          <p className="text-zinc-500 mt-2 text-sm">Sua senha e provisoria e precisa ser alterada</p>
        </div>

        {/* Alert */}
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/15 p-4 mb-6 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/15 shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-300">Senha provisoria detectada</p>
            <p className="text-xs text-amber-400/60 mt-1 leading-relaxed">
              Por seguranca, crie uma nova senha antes de acessar o sistema. A nova senha deve ser diferente de "123456".
            </p>
          </div>
        </div>

        <Card className="shadow-2xl shadow-black/50 border-white/[0.06] backdrop-blur-xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nova senha</Label>
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
                <Label>Confirmar nova senha</Label>
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

              {/* Password strength indicator */}
              {novaSenha.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          novaSenha.length >= level * 3
                            ? novaSenha.length >= 12 ? 'bg-emerald-500' : novaSenha.length >= 8 ? 'bg-blue-500' : 'bg-amber-500'
                            : 'bg-white/[0.06]'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {novaSenha.length < 6 ? 'Muito curta' : novaSenha.length < 8 ? 'Razoavel' : novaSenha.length < 12 ? 'Boa' : 'Forte'}
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-500/8 border border-red-500/15 p-3.5 flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
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
