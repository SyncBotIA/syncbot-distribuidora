import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { Empresa, EmpresaUsuario, Hierarquia } from '@/types/database'

interface EmpresaContextType {
  empresa: Empresa | null
  empresaUsuario: EmpresaUsuario | null
  hierarquiaOrdem: number | null
  hierarquiaNome: string | null
  empresas: Empresa[]
  loading: boolean
  empresaSelecionada: boolean
  setEmpresaId: (id: string) => Promise<boolean | undefined>
  clearEmpresa: () => void
  refreshEmpresas: () => Promise<void>
  isAdmin: boolean
  isGerente: boolean
  isVendedor: boolean
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
  const [hierarquiaNome, setHierarquiaNome] = useState<string | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaLoading, setEmpresaLoading] = useState(true)
  const [empresaSelecionada, setEmpresaSelecionada] = useState(false)

  // Loading é true enquanto auth OU empresa estiver carregando (e se ainda não tem empresa)
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
      setHierarquiaNome(hierarquia?.nome ?? null)
    } else {
      // Master sem vínculo direto - dar acesso total
      setEmpresaUsuario(null)
      setHierarquiaOrdem(1)
      setHierarquiaNome('Admin')
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
  // Só executa uma vez por sessão para evitar re-fetch em navegações
  const initializedRef = useRef(false)

  useEffect(() => {
    // Esperar auth terminar de carregar
    if (authLoading) return

    if (!usuario) {
      setEmpresa(null)
      setEmpresaUsuario(null)
      setHierarquiaOrdem(null)
      setHierarquiaNome(null)
      setEmpresas([])
      setEmpresaLoading(false)
      initializedRef.current = false
      return
    }

    // Só rodar depois que usuario está disponível
    if (!usuario?.id) return

    if (initializedRef.current) return
    initializedRef.current = true

    let cancelled = false

    async function init() {
      setEmpresaLoading(true)

      // 1. Tentar restaurar empresa do localStorage
      const restoredEmpresa = localStorage.getItem(STORAGE_KEY)
      if (restoredEmpresa) {
        const success = await loadEmpresaData(restoredEmpresa, usuario!.id)
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
    const success = await loadEmpresaData(empresaId, usuario.id)
    if (success) {
      setEmpresaSelecionada(true)
      setEmpresaLoading(false)
    }
    return success
  }

  function clearEmpresa() {
    setEmpresa(null)
    setEmpresaUsuario(null)
    setHierarquiaOrdem(null)
    setHierarquiaNome(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const nomeLower = hierarquiaNome?.toLowerCase() || ''
  const isAdmin = nomeLower.includes('admin')
  const isGerente = nomeLower.includes('gerente')
  const isVendedor = hierarquiaNome !== null && !isAdmin && !isGerente
  const canManageProducts = isAdmin || isGerente
  const canManageStock = isAdmin || isGerente

  return (
    <EmpresaContext.Provider value={{
      empresa,
      empresaUsuario,
      hierarquiaOrdem,
      hierarquiaNome,
      empresas,
      loading,
      setEmpresaId,
      clearEmpresa,
      refreshEmpresas,
      isAdmin,
      isGerente,
      isVendedor,
      canManageProducts,
      canManageStock,
    }}>
      {children}
    </EmpresaContext.Provider>
  )
}
