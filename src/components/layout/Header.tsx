import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, LogOut, ArrowLeft, Building2 } from 'lucide-react'
import NotificationBell from '@/components/ui/NotificationBell'

function UserMenuMobile({ initials, nome, signOut }: { initials: string; nome?: string; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative sm:hidden" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center p-1 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer touch-manipulation"
      >
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20">
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#0c1220] border border-white/[0.08] shadow-xl shadow-black/40 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-zinc-200 truncate">{nome}</p>
          </div>
          <button
            onClick={() => { setOpen(false); signOut() }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sair do sistema
          </button>
        </div>
      )}
    </div>
  )
}

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { usuario, signOut, isMaster } = useAuth()
  const { empresa, empresas, clearEmpresa } = useEmpresa()
  const navigate = useNavigate()

  const initials = usuario?.nome
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <header className="h-14 sm:h-16 border-b border-white/[0.06] bg-[#060a14]/90 backdrop-blur-xl flex items-center justify-between px-3 sm:px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden cursor-pointer p-1.5 rounded-xl hover:bg-white/[0.06] transition-all touch-manipulation">
          <Menu className="h-5 w-5 text-zinc-400" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 items-center justify-center border border-blue-500/10">
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight tracking-tight">{empresa?.nome}</h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {isMaster && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearEmpresa(); navigate('/master') }}
            className="gap-1.5 text-xs h-8 border-dashed border-blue-500/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/5 hover:border-blue-500/30"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Master</span>
          </Button>
        )}
        {!isMaster && empresas.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearEmpresa(); navigate('/selecionar-empresa') }}
            className="gap-1.5 text-xs h-8"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trocar</span>
          </Button>
        )}

        <NotificationBell />
        <div className="h-6 w-px bg-white/[0.06] mx-0.5 hidden sm:block" />

        {/* Desktop: botão direto */}
        <button
          onClick={signOut}
          className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer touch-manipulation group"
        >
          <div className="relative">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-all">
              {initials}
            </div>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-zinc-200 leading-tight">{usuario?.nome}</p>
            <p className="text-[10px] text-zinc-500 leading-tight flex items-center gap-0.5">
              Sair <LogOut className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>
        </button>

        {/* Mobile: avatar com menu dropdown */}
        <UserMenuMobile initials={initials} nome={usuario?.nome} signOut={signOut} />
      </div>
    </header>
  )
}
