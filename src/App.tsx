import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { EmpresaProvider, useEmpresa } from '@/contexts/EmpresaContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import MainLayout from '@/components/layout/MainLayout'
import Login from '@/pages/Login'
import SelecionarEmpresa from '@/pages/SelecionarEmpresa'
import RedefinirSenha from '@/pages/RedefinirSenha'
import { lazy, Suspense, type ReactNode } from 'react'

// Lazy-load das páginas pesadas
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Hierarquias = lazy(() => import('@/pages/Hierarquias'))
const Usuarios = lazy(() => import('@/pages/Usuarios'))
const Produtos = lazy(() => import('@/pages/Produtos'))
const Estoque = lazy(() => import('@/pages/Estoque'))
const Pedidos = lazy(() => import('@/pages/Pedidos'))
const Clientes = lazy(() => import('@/pages/Clientes'))
const Fornecedores = lazy(() => import('@/pages/Fornecedores'))
const MasterPanel = lazy(() => import('@/pages/MasterPanel'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const Entregas = lazy(() => import('@/pages/Entregas'))
const CriarEmpresa = lazy(() => import('@/pages/CriarEmpresa'))

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm">Carregando...</p>
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!empresa) return <Navigate to="/selecionar-empresa" replace />
  return <>{children}</>
}

function DashboardGuard() {
  const { hasPermission } = useEmpresa()
  if (!hasPermission('dashboard.ver')) return <Navigate to="/entregas" replace />
  return <Dashboard />
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
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
          <Route path="/dashboard" element={<DashboardGuard />} />
          <Route path="/hierarquias" element={<Hierarquias />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/entregas" element={<Entregas />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <EmpresaProvider>
              <AppRoutes />
            </EmpresaProvider>
          </AuthProvider>
        </ToastProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  )
}
