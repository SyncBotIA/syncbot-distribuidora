import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { Empresa, EmpresaUsuario, Hierarquia } from '@/types/database'

interface EmpresaContextType {
  empresa: Empresa | null
  empresaUsuario: EmpresaUsuario | null
  hierarquiaOrdem: number | null
  empresas: Empresa[]
  loading: boolean
  setEmpresaId: (id: string) => void
  refreshEmpresas: () => Promise<void>
  isAdmin: boolean
  canManageProducts: boolean
  canManageStock: boolean
}

const EmpresaContext = createContext<EmpresaContextType | null>(null)

export function useEmpresa() {
  const context = useContext(EmpresaContext)
  if (!context) throw new Error('useEmpresa must be used within EmpresaProvider')
  return context
}

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [empresaUsuario, setEmpresaUsuario] = useState<EmpresaUsuario | null>(null)
  const [hierarquiaOrdem, setHierarquiaOrdem] = useState<number | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  const refreshEmpresas = useCallback(async () => {
    if (!usuario) {
      setEmpresas([])
      setLoading(false)
      return
    }

    const { data: euData } = await supabase
      .from('empresa_usuarios')
      .select('empresa_id, empresas(*)')
      .eq('usuario_id', usuario.id)
      .eq('ativo', true)

    if (euData) {
      const empresasList = euData
        .map((eu: Record<string, unknown>) => eu.empresas as Empresa)
        .filter(Boolean)
      setEmpresas(empresasList)

      if (empresasList.length === 1 && !empresa) {
        setEmpresaId(empresasList[0].id)
      }
    }
    setLoading(false)
  }, [usuario])

  useEffect(() => {
    refreshEmpresas()
  }, [refreshEmpresas])

  async function setEmpresaId(empresaId: string) {
    if (!usuario) return

    const { data: empData } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', empresaId)
      .single()

    setEmpresa(empData)

    const { data: euData } = await supabase
      .from('empresa_usuarios')
      .select('*, hierarquias(*)')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuario.id)
      .single()

    if (euData) {
      setEmpresaUsuario(euData)
      const hierarquia = euData.hierarquias as unknown as Hierarquia
      setHierarquiaOrdem(hierarquia?.ordem ?? null)
    }
  }

  const isAdmin = hierarquiaOrdem === 1
  const canManageProducts = hierarquiaOrdem !== null && hierarquiaOrdem <= 2
  const canManageStock = hierarquiaOrdem !== null && hierarquiaOrdem <= 2

  return (
    <EmpresaContext value={{
      empresa,
      empresaUsuario,
      hierarquiaOrdem,
      empresas,
      loading,
      setEmpresaId,
      refreshEmpresas,
      isAdmin,
      canManageProducts,
      canManageStock,
    }}>
      {children}
    </EmpresaContext>
  )
}
