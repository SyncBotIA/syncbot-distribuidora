import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { EmpresaProvider, useEmpresa } from '@/contexts/EmpresaContext'
import { ToastProvider } from '@/components/ui/toast'
import MainLayout from '@/components/layout/MainLayout'
import Login from '@/pages/Login'
import SelecionarEmpresa from '@/pages/SelecionarEmpresa'
import CriarEmpresa from '@/pages/CriarEmpresa'
import Dashboard from '@/pages/Dashboard'
import Hierarquias from '@/pages/Hierarquias'
import Usuarios from '@/pages/Usuarios'
import Produtos from '@/pages/Produtos'
import Estoque from '@/pages/Estoque'
import Pedidos from '@/pages/Pedidos'
import Clientes from '@/pages/Clientes'
import MasterPanel from '@/pages/MasterPanel'
import Configuracoes from '@/pages/Configuracoes'
import RedefinirSenha from '@/pages/RedefinirSenha'
import type { ReactNode } from 'react'

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PasswordGuard({ children }: { children: ReactNode }) {
  const { needsPasswordReset, loading } = useAuth()

  if (loading) return null

  if (needsPasswordReset) return <Navigate to="/redefinir-senha" replace />
  return <>{children}</>
}

function EmpresaRoute({ children }: { children: ReactNode }) {
  const { empresa, loading } = useEmpresa()

  if (loading) {
    // If user just selected empresa and localStorage has it, render children
    if (localStorage.getItem('distribuidora_empresa_id')) return <>{children}</>
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!empresa) return <Navigate to="/selecionar-empresa" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/redefinir-senha" element={
        <PrivateRoute><RedefinirSenha /></PrivateRoute>
      } />

      <Route path="/selecionar-empresa" element={
        <PrivateRoute><PasswordGuard><SelecionarEmpresa /></PasswordGuard></PrivateRoute>
      } />

      <Route path="/criar-empresa" element={
        <PrivateRoute><PasswordGuard><CriarEmpresa /></PasswordGuard></PrivateRoute>
      } />

      <Route path="/master" element={
        <PrivateRoute><PasswordGuard><MasterPanel /></PasswordGuard></PrivateRoute>
      } />

      <Route element={
        <PrivateRoute>
          <PasswordGuard>
            <EmpresaRoute>
              <MainLayout />
            </EmpresaRoute>
          </PasswordGuard>
        </PrivateRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/hierarquias" element={<Hierarquias />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <EmpresaProvider>
            <AppRoutes />
          </EmpresaProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
