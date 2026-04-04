import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-[#030712] p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-800/6 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[30%] left-[-5%] w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="relative inline-flex">
            <div className="h-18 w-18 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-6">
              <Package className="h-9 w-9 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Distribuidora</h1>
          <p className="text-zinc-500 mt-2 text-sm">Sistema de Gestao Empresarial</p>
        </div>

        <Card className="shadow-2xl shadow-black/50 border-white/[0.06] backdrop-blur-xl">
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-1 mb-7">
              <div className={`h-1 rounded-full transition-all duration-300 ${isLogin ? 'w-8 bg-blue-500' : 'w-2 bg-zinc-700'}`} />
              <div className={`h-1 rounded-full transition-all duration-300 ${!isLogin ? 'w-8 bg-blue-500' : 'w-2 bg-zinc-700'}`} />
            </div>

            <h2 className="text-lg font-bold text-center mb-6 text-white">
              {isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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

              {error && (
                <div className="rounded-xl bg-red-500/8 border border-red-500/15 p-3.5 flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              {successMsg && (
                <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 p-3.5 flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <p className="text-sm text-emerald-400">{successMsg}</p>
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2 gap-2" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Aguarde...
                  </div>
                ) : (
                  <>
                    {isLogin ? 'Entrar' : 'Criar Conta'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-[#0a0f1a] text-zinc-600">ou</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg('') }}
                className="w-full h-10 rounded-xl border border-white/[0.06] text-sm text-zinc-400 font-medium hover:bg-white/[0.03] hover:text-zinc-300 cursor-pointer transition-all"
              >
                {isLogin ? 'Criar uma conta' : 'Ja tenho conta'}
              </button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-zinc-600 mt-6">
          Distribuidora v1.0 — Sistema de Gestao
        </p>
      </div>
    </div>
  )
}
