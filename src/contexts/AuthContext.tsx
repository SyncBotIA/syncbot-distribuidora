import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Usuario } from '@/types/database'

interface AuthContextType {
  user: User | null
  usuario: Usuario | null
  session: Session | null
  loading: boolean
  isMaster: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUsuario(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUsuario(session.user.id)
      } else {
        setUsuario(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUsuario(authId: string) {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', authId)
      .single()

    if (data) {
      setUsuario(data)
    } else {
      // Se não existe na tabela usuarios, criar automaticamente
      const { data: authUser } = await supabase.auth.getUser()
      if (authUser?.user) {
        const { data: newUser } = await supabase
          .from('usuarios')
          .insert({
            auth_id: authUser.user.id,
            nome: authUser.user.email?.split('@')[0] ?? 'Usuário',
            email: authUser.user.email ?? '',
          })
          .select()
          .single()
        setUsuario(newUser)
      }
    }
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signUp(email: string, password: string, nome: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error as Error | null }

    if (data.user) {
      const { error: insertError } = await supabase.from('usuarios').insert({
        auth_id: data.user.id,
        nome,
        email,
      })
      if (insertError) return { error: insertError as Error | null }
    }

    return { error: null }
  }

  async function signOut() {
    localStorage.removeItem('distribuidora_empresa_id')
    await supabase.auth.signOut()
    setUser(null)
    setUsuario(null)
    setSession(null)
  }

  const isMaster = usuario?.is_master ?? false

  return (
    <AuthContext value={{ user, usuario, session, loading, isMaster, signIn, signUp, signOut }}>
      {children}
    </AuthContext>
  )
}
