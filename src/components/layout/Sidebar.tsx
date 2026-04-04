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
  ChevronRight,
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
          'fixed top-0 left-0 z-50 h-full w-[260px] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          'bg-gradient-to-b from-[#0a0a12] to-[#0d0d1a] text-sidebar-foreground border-r border-white/[0.06]',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-[13px] leading-tight text-white tracking-tight">{empresa?.nome ?? 'Distribuidora'}</h2>
              <p className="text-[11px] text-zinc-500 font-medium">Sistema de Gestao</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden cursor-pointer text-zinc-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-white/[0.06]" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">Navegacao</p>
          {links.filter((l) => l.show).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                )
              }
            >
              <link.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{link.label}</span>
              <ChevronRight className={cn(
                'h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all duration-200',
                'group-hover:opacity-50 group-hover:translate-x-0'
              )} />
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 space-y-3">
          <div className="rounded-xl bg-gradient-to-r from-blue-600/10 to-blue-500/5 border border-blue-500/10 p-3.5">
            <p className="text-[11px] text-blue-300 font-semibold mb-1">Precisa de ajuda?</p>
            <p className="text-[10px] text-zinc-500 leading-relaxed">Entre em contato com o suporte para qualquer duvida.</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
              <p className="text-[11px] text-zinc-500 font-medium">Sistema Online</p>
            </div>
            <p className="text-[10px] text-zinc-600 font-mono">v1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  )
}
