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
import type { ReactNode } from 'react'

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function EmpresaRoute({ children }: { children: ReactNode }) {
  const { empresa, loading } = useEmpresa()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
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

      <Route path="/selecionar-empresa" element={
        <PrivateRoute><SelecionarEmpresa /></PrivateRoute>
      } />

      <Route path="/criar-empresa" element={
        <PrivateRoute><CriarEmpresa /></PrivateRoute>
      } />

      <Route path="/master" element={
        <PrivateRoute><MasterPanel /></PrivateRoute>
      } />

      <Route element={
        <PrivateRoute>
          <EmpresaRoute>
            <MainLayout />
          </EmpresaRoute>
        </PrivateRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/hierarquias" element={<Hierarquias />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/pedidos" element={<Pedidos />} />
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
