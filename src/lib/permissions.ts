/**
 * Registro central de todas as permissoes do sistema.
 * Fonte unica de verdade para chaves e labels.
 */

export const PERMISSION_GROUPS = {
  dashboard: {
    label: 'Dashboard',
    permissions: {
      'dashboard.ver': 'Acessar o dashboard',
      'dashboard.ranking': 'Ver ranking de vendedores',
      'dashboard.estoque_critico': 'Ver produtos com estoque critico',
    },
  },
  pedidos: {
    label: 'Pedidos',
    permissions: {
      'pedidos.ver': 'Acessar a tela de pedidos',
      'pedidos.ver_todos': 'Ver todos os pedidos (senao ve apenas os proprios)',
      'pedidos.criar': 'Criar novo pedido',
      'pedidos.editar': 'Editar pedido existente',
      'pedidos.cancelar': 'Cancelar pedido',
      'pedidos.confirmar': 'Confirmar pedido',
      'pedidos.marcar_entregue': 'Marcar pedido como entregue',
      'pedidos.atribuir_vendedor': 'Escolher vendedor ao criar pedido',
      'pedidos.atribuir_entregador': 'Atribuir entregador ao pedido',
      'pedidos.gerar_nfe': 'Gerar nota fiscal eletronica',
      'pedidos.baixar_csv': 'Exportar pedidos em CSV',
    },
  },
  produtos: {
    label: 'Produtos',
    permissions: {
      'produtos.ver': 'Acessar a tela de produtos',
      'produtos.criar': 'Criar novo produto',
      'produtos.editar': 'Editar produto',
      'produtos.excluir': 'Excluir produto',
      'produtos.gerenciar_categorias': 'Gerenciar categorias',
      'produtos.vincular_fornecedores': 'Vincular produtos a fornecedores',
    },
  },
  estoque: {
    label: 'Estoque',
    permissions: {
      'estoque.ver': 'Acessar a tela de estoque',
      'estoque.movimentar': 'Criar nova movimentacao',
      'estoque.historico': 'Ver historico de movimentacoes',
      'estoque.importar_planilha': 'Importar entradas de estoque via planilha',
    },
  },
  fornecedores: {
    label: 'Fornecedores',
    permissions: {
      'fornecedores.ver': 'Acessar a tela de fornecedores',
      'fornecedores.criar': 'Criar novo fornecedor',
      'fornecedores.editar': 'Editar fornecedor',
      'fornecedores.excluir': 'Excluir fornecedor',
      'fornecedores.importar': 'Importar fornecedores via planilha',
      'fornecedores.vincular_produtos': 'Vincular produtos a fornecedores',
    },
  },
  clientes: {
    label: 'Clientes',
    permissions: {
      'clientes.ver': 'Acessar a tela de clientes',
      'clientes.criar': 'Criar novo cliente',
      'clientes.editar': 'Editar cliente',
      'clientes.excluir': 'Excluir cliente',
      'clientes.atribuir_vendedor': 'Escolher vendedor do cliente',
      'clientes.baixar_csv': 'Exportar clientes em CSV',
    },
  },
  usuarios: {
    label: 'Usuarios',
    permissions: {
      'usuarios.ver': 'Acessar a tela de usuarios',
      'usuarios.criar': 'Criar novo usuario',
      'usuarios.editar': 'Editar usuario',
      'usuarios.excluir': 'Excluir usuario',
    },
  },
  entregas: {
    label: 'Entregas',
    permissions: {
      'entregas.ver': 'Acessar a tela de entregas',
      'entregas.confirmar': 'Confirmar entrega com foto',
    },
  },
  configuracoes: {
    label: 'Configuracoes',
    permissions: {
      'configuracoes.pagamento': 'Gerenciar condicoes e formas de pagamento',
    },
  },
} as const

/** Todas as chaves de permissao */
export const ALL_PERMISSION_KEYS = Object.values(PERMISSION_GROUPS).flatMap(
  (group) => Object.keys(group.permissions)
)

/** Tipo union de todas as chaves */
export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number]

/** Mapa rota → permissao necessaria para visibilidade no menu */
export const ROUTE_PERMISSIONS: Record<string, string | null> = {
  '/dashboard': 'dashboard.ver',
  '/pedidos': 'pedidos.ver',
  '/produtos': 'produtos.ver',
  '/estoque': 'estoque.ver',
  '/clientes': 'clientes.ver',
  '/fornecedores': 'fornecedores.ver',
  '/usuarios': 'usuarios.ver',
  '/entregas': 'entregas.ver',
  '/hierarquias': null, // admin-only, hardcoded
  '/configuracoes': null, // sempre visivel
  '/configuracoes/pagamento': 'configuracoes.pagamento',
}
