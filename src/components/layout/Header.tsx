import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, LogOut, ArrowLeft, User } from 'lucide-react'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { usuario, signOut, isMaster } = useAuth()
  const { empresa, empresas, clearEmpresa } = useEmpresa()
  const navigate = useNavigate()

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0 shadow-sm">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden cursor-pointer p-1 rounded-md hover:bg-accent">
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-foreground">{empresa?.nome}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isMaster && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearEmpresa(); navigate('/master') }}
            className="gap-1.5 text-xs"
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
            className="gap-1.5 text-xs"
          >
            <span className="hidden sm:inline">Trocar Empresa</span>
          </Button>
        )}
        <div className="hidden sm:flex items-center gap-2 pl-3 border-l">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">{usuario?.nome}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
