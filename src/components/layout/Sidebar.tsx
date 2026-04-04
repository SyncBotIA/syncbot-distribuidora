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
    { to: '/usuarios', label: 'Usuarios', icon: Users, show: true },
    { to: '/clientes', label: 'Clientes', icon: UserCheck, show: true },
    { to: '/produtos', label: 'Produtos', icon: Package, show: true },
    { to: '/estoque', label: 'Estoque', icon: Warehouse, show: canManageProducts },
    { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart, show: true },
    { to: '/configuracoes', label: 'Configuracoes', icon: Settings, show: true },
  ]

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          'bg-sidebar text-sidebar-foreground',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight text-white">{empresa?.nome ?? 'Distribuidora'}</h2>
              <p className="text-[11px] text-zinc-400">Sistema de Gestao</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden cursor-pointer text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-zinc-800" />

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 mt-2">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Menu</p>
          {links.filter((l) => l.show).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
                )
              }
            >
              <link.icon className="h-[18px] w-[18px]" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4">
          <div className="rounded-lg bg-zinc-900 p-3">
            <p className="text-[11px] text-zinc-500">Versao 1.0</p>
          </div>
        </div>
      </aside>
    </>
  )
}
