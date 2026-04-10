import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'

/**
 * Hook centralizado de permissões.
 * Fonte única de verdade para verificar o que o usuário pode fazer.
 *
 * Hierarquia de acesso (do mais alto ao mais baixo):
 *   Master > Admin > Gerente > Vendedor
 */
export function usePermissions() {
  const { usuario, isMaster } = useAuth()
  const { empresaUsuario, hierarquiaNome, isAdmin, isGerente, isVendedor } = useEmpresa()

  // Nível numérico para comparações (maior = mais poder)
  const accessLevel = isMaster ? 4 : isAdmin ? 3 : isGerente ? 2 : 1

  return {
    // === Identidade ===
    isMaster,
    isAdmin,
    isGerente,
    isVendedor,
    accessLevel,
    roleName: isMaster ? 'master' : (hierarquiaNome?.toLowerCase() || 'vendedor'),

    // === Permissões de leitura ===
    canViewRanking: isMaster || isAdmin || isGerente,
    canViewAllPedidos: isMaster || isAdmin || isGerente,
    canViewEstoqueCritico: isMaster || isAdmin,
    canViewAllUsers: true, // todos veem a lista, mas ações são restritas

    // === Permissões de escrita ===
    canManageHierarquias: isMaster || isAdmin,
    canManageUsers: isMaster || isAdmin,
    canManageProducts: isMaster || isAdmin || isGerente,
    canManageStock: isMaster || isAdmin || isGerente,
    canManageCategories: isMaster || isAdmin || isGerente,
    canCreatePedido: true, // todos podem criar pedidos
    canCreateCliente: true, // todos podem cadastrar clientes
    canDeletePedido: isMaster || isAdmin,
    canDeleteCliente: isMaster || isAdmin,
    canDeleteProduct: isMaster || isAdmin,
    canEditEmpresa: isMaster || isAdmin,

    // === Permissões sobre outros usuários ===
    canEditUser: (targetUsuarioId: string) => {
      // Próprio perfil: sempre
      if (targetUsuarioId === usuario?.id) return true
      // Master/Admin: todos
      if (isMaster || isAdmin) return true
      // Gerente: subordinados (verificado pela lista local)
      // Vendedor: nunca
      return false
    },

    canDeleteUser: (targetUsuarioId: string) => {
      // Nunca excluir a si mesmo
      if (targetUsuarioId === usuario?.id) return false
      // Master/Admin: sim
      if (isMaster || isAdmin) return true
      // Gerente e abaixo: não
      return false
    },

    // === Permissões sobre pedidos ===
    canEditPedido: (pedidoUsuarioId: string) => {
      // Dono do pedido
      if (pedidoUsuarioId === usuario?.id) return true
      // Admin+
      if (isMaster || isAdmin) return true
      return false
    },

    // === Permissões sobre clientes ===
    canEditCliente: (vendedorEuId: string | null) => {
      // Admin/Gerente+
      if (isMaster || isAdmin || isGerente) return true
      // Vendedor dono do cliente
      if (vendedorEuId && empresaUsuario && vendedorEuId === empresaUsuario.id) return true
      return false
    },
  }
}
