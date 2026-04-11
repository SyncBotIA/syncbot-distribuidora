import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { ALL_PERMISSION_KEYS } from '@/lib/permissions'
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
  permissoes: Set<string>
  hasPermission: (key: string) => boolean
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
  const [permissoes, setPermissoes] = useState<Set<string>>(new Set())

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

      const nomeLower = (hierarquia?.nome ?? '').toLowerCase()
      const ehAdmin = nomeLower.includes('admin')

      // Admin e Master sempre tem todas as permissoes
      if (ehAdmin) {
        setPermissoes(new Set(ALL_PERMISSION_KEYS))
      } else if (hierarquia?.id) {
        // Buscar permissoes da hierarquia no banco
        const { data: permsData } = await supabase
          .from('hierarquia_permissoes')
          .select('permissao')
          .eq('hierarquia_id', hierarquia.id)
        setPermissoes(new Set((permsData ?? []).map(p => p.permissao)))
      } else {
        setPermissoes(new Set())
      }
    } else {
      // Master sem vinculo direto - acesso total
      setEmpresaUsuario(null)
      setHierarquiaOrdem(1)
      setHierarquiaNome('Admin')
      setPermissoes(new Set(ALL_PERMISSION_KEYS))
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

  const initializedRef = useRef(false)

  useEffect(() => {
    if (authLoading) return

    if (!usuario) {
      setEmpresa(null)
      setEmpresaUsuario(null)
      setHierarquiaOrdem(null)
      setHierarquiaNome(null)
      setEmpresas([])
      setPermissoes(new Set())
      setEmpresaLoading(false)
      initializedRef.current = false
      return
    }

    if (!usuario?.id) return
    if (initializedRef.current) return
    initializedRef.current = true

    let cancelled = false

    async function init() {
      setEmpresaLoading(true)

      const restoredEmpresa = localStorage.getItem(STORAGE_KEY)
      if (restoredEmpresa) {
        const success = await loadEmpresaData(restoredEmpresa, usuario!.id)
        if (success && !cancelled) {
          const list = await loadEmpresas(usuario!.id, isMaster)
          if (!cancelled) {
            setEmpresas(list)
            setEmpresaLoading(false)
          }
          return
        }
      }

      if (cancelled) return

      const list = await loadEmpresas(usuario!.id, isMaster)
      if (cancelled) return

      setEmpresas(list)

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
    setPermissoes(new Set())
    localStorage.removeItem(STORAGE_KEY)
  }

  const nomeLower = hierarquiaNome?.toLowerCase() || ''
  const isAdmin = nomeLower.includes('admin')

  function hasPermission(key: string): boolean {
    if (isMaster || isAdmin) return true
    return permissoes.has(key)
  }

  return (
    <EmpresaContext.Provider value={{
      empresa,
      empresaUsuario,
      hierarquiaOrdem,
      hierarquiaNome,
      empresas,
      loading,
      empresaSelecionada,
      setEmpresaId,
      clearEmpresa,
      refreshEmpresas,
      isAdmin,
      permissoes,
      hasPermission,
    }}>
      {children}
    </EmpresaContext.Provider>
  )
}
