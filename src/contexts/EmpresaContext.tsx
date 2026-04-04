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
  const { usuario, isMaster, loading: authLoading } = useAuth()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [empresaUsuario, setEmpresaUsuario] = useState<EmpresaUsuario | null>(null)
  const [hierarquiaOrdem, setHierarquiaOrdem] = useState<number | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaLoading, setEmpresaLoading] = useState(true)

  // Loading é true enquanto auth OU empresa estiver carregando
  const loading = authLoading || empresaLoading

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

    setEmpresa(empData)

    if (euData) {
      setEmpresaUsuario(euData)
      const hierarquia = euData.hierarquias as unknown as Hierarquia
      setHierarquiaOrdem(hierarquia?.ordem ?? null)
    } else {
      // Master sem vínculo direto - dar acesso total
      setEmpresaUsuario(null)
      setHierarquiaOrdem(1)
    }

    localStorage.setItem(STORAGE_KEY, empresaId)
    return true
  }, [])

  async function loadEmpresas(usuarioId: string, master: boolean): Promise<Empresa[]> {
    if (master) {
      const { data } = await supabase.from('empresas').select('*').order('nome')
      return data ?? []
    }

    const { data: euData } = await supabase
      .from('empresa_usuarios')
      .select('empresa_id, empresas(*)')
      .eq('usuario_id', usuarioId)
      .eq('ativo', true)

    const list = euData
      ? euData.map((eu: Record<string, unknown>) => eu.empresas as Empresa).filter(Boolean)
      : []

    const uniqueMap = new Map<string, Empresa>()
    for (const e of list) uniqueMap.set(e.id, e)
    return Array.from(uniqueMap.values())
  }

  const refreshEmpresas = useCallback(async () => {
    if (!usuario) {
      setEmpresas([])
      setEmpresaLoading(false)
      return
    }

    const list = await loadEmpresas(usuario.id, isMaster)
    setEmpresas(list)
    setEmpresaLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, isMaster])

  // Efeito principal: restaurar empresa ao carregar
  useEffect(() => {
    // Esperar auth terminar de carregar
    if (authLoading) return

    if (!usuario) {
      setEmpresa(null)
      setEmpresaUsuario(null)
      setHierarquiaOrdem(null)
      setEmpresas([])
      setEmpresaLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      setEmpresaLoading(true)

      // 1. Tentar restaurar empresa do localStorage
      const savedId = localStorage.getItem(STORAGE_KEY)
      if (savedId) {
        const success = await loadEmpresaData(savedId, usuario!.id)
        if (success && !cancelled) {
          // Restaurou! Carregar lista de empresas em background
          const list = await loadEmpresas(usuario!.id, isMaster)
          if (!cancelled) {
            setEmpresas(list)
            setEmpresaLoading(false)
          }
          return
        }
      }

      if (cancelled) return

      // 2. Não tinha savedId ou falhou - carregar lista
      const list = await loadEmpresas(usuario!.id, isMaster)
      if (cancelled) return

      setEmpresas(list)

      // 3. Auto-selecionar se só tem 1 empresa
      if (list.length === 1) {
        await loadEmpresaData(list[0].id, usuario!.id)
      }

      if (!cancelled) {
        setEmpresaLoading(false)
      }
    }

    init()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, authLoading, isMaster])

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
