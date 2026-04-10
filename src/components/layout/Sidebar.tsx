import { NavLink } from 'react-router-dom'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
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
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { empresa } = useEmpresa()
  const { isAdmin, canManageProducts } = usePermissions()

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/hierarquias', label: 'Hierarquias', icon: ShieldCheck, show: isAdmin },
    { to: '/usuarios', label: 'Usuários', icon: Users, show: true },
    { to: '/clientes', label: 'Clientes', icon: UserCheck, show: true },
    { to: '/produtos', label: 'Produtos', icon: Package, show: true },
    { to: '/estoque', label: 'Estoque', icon: Warehouse, show: canManageProducts },
    { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart, show: true },
    { to: '/configuracoes', label: 'Configurações', icon: Settings, show: true },
  ]

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[260px] flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:z-auto',
          'bg-gradient-to-b from-[#080b14] via-[#0a0d18] to-[#060912] text-sidebar-foreground border-r border-white/[0.06]',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#080b14] shadow-sm shadow-emerald-400/50" />
            </div>
            <div>
              <h2 className="font-bold text-[13px] leading-tight text-white tracking-tight">{empresa?.nome ?? 'Distribuidora'}</h2>
              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Sistema de Gestão</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden cursor-pointer p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-white/[0.05]" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Menu</p>
          {links.filter((l) => l.show).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/90 to-blue-500/80 text-white shadow-lg shadow-blue-600/20'
                    : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                  )}
                  <link.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'drop-shadow-sm')} />
                  <span className="flex-1">{link.label}</span>
                  <ChevronRight className={cn(
                    'h-3.5 w-3.5 transition-all duration-200',
                    isActive
                      ? 'opacity-60 translate-x-0'
                      : 'opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0'
                  )} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 space-y-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent border border-blue-500/10 p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-[11px] text-blue-300 font-semibold">Suporte</p>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">Entre em contato para qualquer dúvida.</p>
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-400 animate-ping opacity-30" />
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">Online</p>
            </div>
            <p className="text-[10px] text-zinc-600 font-mono">v1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  )
}
