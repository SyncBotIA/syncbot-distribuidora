import { NavLink } from 'react-router-dom'
import { useEmpresa } from '@/contexts/EmpresaContext'
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Package,
  Warehouse,
  ShoppingCart,
  UserCheck,
  X,
  Building2,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { empresa, isAdmin, canManageProducts } = useEmpresa()

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/hierarquias', label: 'Hierarquias', icon: ShieldCheck, show: isAdmin },
    { to: '/usuarios', label: 'Usuários', icon: Users, show: true },
    { to: '/clientes', label: 'Clientes', icon: UserCheck, show: true },
    { to: '/produtos', label: 'Produtos', icon: Package, show: true },
    { to: '/estoque', label: 'Estoque', icon: Warehouse, show: canManageProducts },
    { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart, show: true },
    { to: '/configuracoes', label: 'Configuracoes', icon: Settings, show: true },
  ]

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-background border-r flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-semibold text-sm leading-tight">{empresa?.nome ?? 'Distribuidora'}</h2>
              <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.filter((l) => l.show).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
