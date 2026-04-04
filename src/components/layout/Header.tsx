import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, LogOut, ArrowLeft, Building2, ChevronDown } from 'lucide-react'

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
    <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 shadow-sm shadow-slate-100/50">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors">
          <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex h-8 w-8 rounded-lg bg-primary/10 items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">{empresa?.nome}</h1>
            <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">Painel de Gestao</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isMaster && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearEmpresa(); navigate('/master') }}
            className="gap-1.5 text-xs h-8 border-dashed"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Painel Master</span>
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
            <span className="hidden sm:inline">Trocar Empresa</span>
          </Button>
        )}

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        <button
          onClick={signOut}
          className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer group"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-foreground leading-tight">{usuario?.nome}</p>
            <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-0.5">
              Sair <LogOut className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>
        </button>
      </div>
    </header>
  )
}
