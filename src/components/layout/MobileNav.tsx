import { NavLink } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  UserCheck,
  Warehouse,
  Settings,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MobileNav() {
  const { isMaster, isAdmin, has } = usePermissions()
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'In\xEDcio', show: has('dashboard.ver') },
    { to: '/clientes', icon: UserCheck, label: 'Clientes', show: has('clientes.ver') },
    { to: '/produtos', icon: Package, label: 'Produtos', show: has('produtos.ver') },
    { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos', show: has('pedidos.ver') },
    { to: '/estoque', icon: Warehouse, label: 'Estoque', show: has('estoque.ver') },
    { to: '/entregas', icon: Truck, label: 'Entregas', show: has('entregas.ver') },
    { to: '/usuarios', icon: Users, label: 'Equipe', show: has('usuarios.ver') },
    { to: '/hierarquias', icon: ShieldCheck, label: 'Cargos', show: isMaster || isAdmin },
    { to: '/configuracoes', icon: Settings, label: 'Mais', show: true },
  ].filter((item) => item.show)

  // Show max 5 primary + "Mais" button for the rest
  const primary = navItems.slice(0, 5)
  const rest = navItems.slice(5)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      {/* Backdrop overlay when "Mais" is open */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
          style={{ bottom: '60px' }}
        />
      )}

      <div className="relative z-50 bg-[#060a14]/95 backdrop-blur-xl border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto px-0.5 py-0.5 gap-0 no-scrollbar">
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center min-w-[56px] flex-1 py-1.5 rounded-lg transition-all duration-150 cursor-pointer touch-manipulation active:scale-95',
                  isActive ? 'text-blue-400' : 'text-zinc-500'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative mb-0.5">
                    <item.icon className="h-[20px] w-[20px]" />
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium leading-tight text-center truncate max-w-[60px]">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* "Mais" menu with remaining items using controlled state */}
          {rest.length > 0 && (
            <div className="relative flex-1 min-w-[56px]">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[56px] w-full py-1.5 rounded-lg transition-all duration-150 cursor-pointer touch-manipulation active:scale-95',
                  moreOpen ? 'text-blue-400' : 'text-zinc-500'
                )}
              >
                <div className="relative mb-0.5">
                  <Settings className="h-[20px] w-[20px]" />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500/20 flex items-center justify-center transition-transform">
                    <span className="text-[7px] font-bold text-blue-400 leading-none">{rest.length}</span>
                  </div>
                </div>
                <span className="text-[10px] font-medium leading-tight">Mais</span>
              </button>

              {/* Dropdown menu */}
              {moreOpen && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] bg-[#0a0f1a]/98 backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-2 py-2 w-48 shadow-2xl shadow-black/60 animate-scale-in">
                  {/* Handle bar indicator */}
                  <div className="w-10 h-1 rounded-full bg-zinc-600 mx-auto mb-2" />
                  {rest.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={() =>
                        cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all active:scale-95 touch-manipulation',
                          'text-zinc-400 active:bg-white/[0.05]'
                        )
                      }
                      onClick={() => setMoreOpen(false)}
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
