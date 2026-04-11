import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'

/**
 * Hook centralizado de permissoes.
 * Permissoes sao carregadas do banco (hierarquia_permissoes).
 * Master e Admin sempre tem todas as permissoes.
 */
export function usePermissions() {
  const { usuario, isMaster } = useAuth()
  const { empresaUsuario, hierarquiaNome, isAdmin, hasPermission } = useEmpresa()

  /** Atalho direto para verificar permissao */
  const has = hasPermission

  return {
    // === Identidade ===
    isMaster,
    isAdmin,
    isGerente: has('pedidos.ver_todos'),
    isVendedor: !isMaster && !isAdmin && !!hierarquiaNome && !has('entregas.confirmar'),
    isEntregador: !isMaster && !isAdmin && has('entregas.confirmar') && !has('pedidos.criar'),
    roleName: isMaster ? 'master' : (hierarquiaNome?.toLowerCase() || 'vendedor'),
    has,

    // === Permissoes de leitura ===
    canViewRanking: has('dashboard.ranking'),
    canViewAllPedidos: has('pedidos.ver_todos'),
    canViewEstoqueCritico: has('dashboard.estoque_critico'),
    canViewAllUsers: has('usuarios.ver'),

    // === Permissoes de escrita ===
    canManageHierarquias: isMaster || isAdmin,
    canManageUsers: has('usuarios.criar'),
    canManageProducts: has('produtos.criar') || has('produtos.editar'),
    canManageStock: has('estoque.movimentar'),
    canManageCategories: has('produtos.gerenciar_categorias'),
    canCreatePedido: has('pedidos.criar'),
    canCreateCliente: has('clientes.criar'),
    canDeletePedido: has('pedidos.cancelar'),
    canDeleteCliente: has('clientes.excluir'),
    canDeleteProduct: has('produtos.excluir'),
    canEditEmpresa: isMaster || isAdmin,

    // === Permissoes sobre outros usuarios ===
    canEditUser: (targetUsuarioId: string) => {
      if (targetUsuarioId === usuario?.id) return true
      return has('usuarios.editar')
    },

    canDeleteUser: (targetUsuarioId: string) => {
      if (targetUsuarioId === usuario?.id) return false
      return has('usuarios.excluir')
    },

    // === Permissoes sobre pedidos ===
    canEditPedido: (pedidoUsuarioId: string) => {
      if (pedidoUsuarioId === usuario?.id) return has('pedidos.editar')
      if (isMaster || isAdmin) return true
      return has('pedidos.editar') && has('pedidos.ver_todos')
    },

    // === Permissoes sobre clientes ===
    canEditCliente: (vendedorEuId: string | null) => {
      if (has('clientes.editar') && has('pedidos.ver_todos')) return true
      if (vendedorEuId && empresaUsuario && vendedorEuId === empresaUsuario.id) return has('clientes.editar')
      return isMaster || isAdmin
    },
  }
}
