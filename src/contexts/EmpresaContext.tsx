import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { Empresa, EmpresaUsuario, Hierarquia } from '@/types/database'

interface EmpresaContextType {
  empresa: Empresa | null
  empresaUsuario: EmpresaUsuario | null
  hierarquiaOrdem: number | null
  empresas: Empresa[]
  loading: boolean
  setEmpresaId: (id: string) => Promise<void>
  clearEmpresa: () => void
  refreshEmpresas: () => Promise<void>
  isAdmin: boolean
  canManageProducts: boolean
  canManageStock: boolean
}

const EmpresaContext = createContext<EmpresaContextType | null>(null)

const STORAGE_KEY = 'distribuidora_empresa_id'

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
  const loadedRef = useRef(false)

  const loadEmpresaData = useCallback(async (empresaId: string, usuarioId: string) => {
    const { data: empData } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', empresaId)
      .single()

    if (!empData) return false

    const { data: euData } = await supabase
      .from('empresa_usuarios')
      .select('*, hierarquias(*)')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuarioId)
      .single()

    if (!euData) return false

    setEmpresa(empData)
    setEmpresaUsuario(euData)
    const hierarquia = euData.hierarquias as unknown as Hierarquia
    setHierarquiaOrdem(hierarquia?.ordem ?? null)
    localStorage.setItem(STORAGE_KEY, empresaId)
    return true
  }, [])

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

    const empresasList = euData
      ? euData
          .map((eu: Record<string, unknown>) => eu.empresas as Empresa)
          .filter(Boolean)
      : []

    // Deduplicate (mesmo empresa_id pode vir mais de uma vez)
    const uniqueMap = new Map<string, Empresa>()
    for (const e of empresasList) {
      uniqueMap.set(e.id, e)
    }
    const uniqueEmpresas = Array.from(uniqueMap.values())
    setEmpresas(uniqueEmpresas)

    // Se já tem empresa carregada, não recarregar
    if (empresa) {
      setLoading(false)
      return
    }

    // Tentar restaurar do localStorage
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (savedId) {
      const found = uniqueEmpresas.find((e) => e.id === savedId)
      if (found) {
        await loadEmpresaData(savedId, usuario.id)
        setLoading(false)
        return
      }
    }

    // Auto-selecionar se só tem 1
    if (uniqueEmpresas.length === 1) {
      await loadEmpresaData(uniqueEmpresas[0].id, usuario.id)
    }

    setLoading(false)
  }, [usuario, empresa, loadEmpresaData])

  useEffect(() => {
    if (usuario && !loadedRef.current) {
      loadedRef.current = true
      refreshEmpresas()
    }
    if (!usuario) {
      loadedRef.current = false
      setEmpresa(null)
      setEmpresaUsuario(null)
      setHierarquiaOrdem(null)
      setEmpresas([])
      setLoading(false)
    }
  }, [usuario])

  async function setEmpresaId(empresaId: string) {
    if (!usuario) return
    await loadEmpresaData(empresaId, usuario.id)
  }

  function clearEmpresa() {
    setEmpresa(null)
    setEmpresaUsuario(null)
    setHierarquiaOrdem(null)
    localStorage.removeItem(STORAGE_KEY)
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
      clearEmpresa,
      refreshEmpresas,
      isAdmin,
      canManageProducts,
      canManageStock,
    }}>
      {children}
    </EmpresaContext>
  )
}
