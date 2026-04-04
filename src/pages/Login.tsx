import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    if (isLogin) {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      } else {
        navigate('/selecionar-empresa')
      }
    } else {
      if (!nome.trim()) {
        setError('Informe seu nome')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, nome)
      if (error) {
        setError(error.message)
      } else {
        setSuccessMsg('Conta criada! Verifique seu email para confirmar.')
        setIsLogin(true)
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#0c1220] p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-800/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mb-5 shadow-xl shadow-blue-500/25">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Distribuidora</h1>
          <p className="text-zinc-500 mt-1.5 text-sm">Sistema de Gestao Empresarial</p>
        </div>

        <Card className="shadow-2xl shadow-black/40 border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
          <CardContent className="p-8">
            <h2 className="text-lg font-semibold text-center mb-6 text-white">
              {isLogin ? 'Acessar sua conta' : 'Criar nova conta'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-zinc-400 text-xs font-medium">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    required={!isLogin}
                    className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-400 text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-400 text-xs font-medium">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-zinc-600 pr-10 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
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

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              {successMsg && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-sm text-emerald-400">{successMsg}</p>
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Aguarde...
                  </div>
                ) : isLogin ? 'Entrar' : 'Criar Conta'}
              </Button>

              <p className="text-center text-sm text-zinc-500 pt-2">
                {isLogin ? 'Nao tem conta?' : 'Ja tem conta?'}{' '}
                <button
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg('') }}
                  className="text-blue-400 font-medium hover:text-blue-300 cursor-pointer transition-colors"
                >
                  {isLogin ? 'Criar conta' : 'Fazer login'}
                </button>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
