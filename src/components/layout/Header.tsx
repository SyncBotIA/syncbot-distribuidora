import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, LogOut, ArrowLeft, Building2, Bell } from 'lucide-react'

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
    <header className="h-16 border-b border-white/[0.06] bg-[#060a14]/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden cursor-pointer p-2 rounded-xl hover:bg-white/[0.06] transition-all">
          <Menu className="h-5 w-5 text-zinc-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 items-center justify-center border border-blue-500/10">
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight tracking-tight">{empresa?.nome}</h1>
            <p className="text-[10px] text-zinc-500 leading-tight hidden sm:block font-medium">Painel de Gestão</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
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

        <div className="h-6 w-px bg-white/[0.06] mx-1 hidden sm:block" />

        <button
          onClick={signOut}
          className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer group"
        >
          <div className="relative">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
              {initials}
            </div>
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-zinc-200 leading-tight">{usuario?.nome}</p>
            <p className="text-[10px] text-zinc-500 leading-tight flex items-center gap-0.5">
              Sair <LogOut className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>
        </button>
      </div>
    </header>
  )
}
