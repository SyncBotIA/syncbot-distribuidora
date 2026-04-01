import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, LogOut, Building2 } from 'lucide-react'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { usuario, signOut } = useAuth()
  const { empresa, empresas } = useEmpresa()
  const navigate = useNavigate()

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden cursor-pointer">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold hidden sm:block">{empresa?.nome}</h1>
      </div>

      <div className="flex items-center gap-2">
        {empresas.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/selecionar-empresa')}
            className="gap-1"
          >
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Trocar</span>
          </Button>
        )}
        <span className="text-sm text-muted-foreground hidden sm:block">{usuario?.nome}</span>
        <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
