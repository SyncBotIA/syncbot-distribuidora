export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: Empresa
        Insert: Omit<Empresa, 'id' | 'created_at'>
        Update: Partial<Omit<Empresa, 'id' | 'created_at'>>
      }
      hierarquias: {
        Row: Hierarquia
        Insert: Omit<Hierarquia, 'id' | 'created_at'>
        Update: Partial<Omit<Hierarquia, 'id' | 'created_at'>>
      }
      usuarios: {
        Row: Usuario
        Insert: Omit<Usuario, 'id' | 'created_at'>
        Update: Partial<Omit<Usuario, 'id' | 'created_at'>>
      }
      empresa_usuarios: {
        Row: EmpresaUsuario
        Insert: Omit<EmpresaUsuario, 'id' | 'created_at'>
        Update: Partial<Omit<EmpresaUsuario, 'id' | 'created_at'>>
      }
      categorias: {
        Row: Categoria
        Insert: Omit<Categoria, 'id' | 'created_at'>
        Update: Partial<Omit<Categoria, 'id' | 'created_at'>>
      }
      produtos: {
        Row: Produto
        Insert: Omit<Produto, 'id' | 'created_at'>
        Update: Partial<Omit<Produto, 'id' | 'created_at'>>
      }
      estoque_movimentacoes: {
        Row: EstoqueMovimentacao
        Insert: Omit<EstoqueMovimentacao, 'id' | 'created_at'>
        Update: Partial<Omit<EstoqueMovimentacao, 'id' | 'created_at'>>
      }
      pedidos: {
        Row: Pedido
        Insert: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Pedido, 'id' | 'created_at'>>
      }
      pedido_itens: {
        Row: PedidoItem
        Insert: Omit<PedidoItem, 'id'>
        Update: Partial<Omit<PedidoItem, 'id'>>
      }
      clientes: {
        Row: Cliente
        Insert: Omit<Cliente, 'id' | 'created_at'>
        Update: Partial<Omit<Cliente, 'id' | 'created_at'>>
      }
    }
    Functions: {
      get_subordinados: {
        Args: { p_empresa_usuario_id: string }
        Returns: { id: string }[]
      }
      get_user_hierarquia_ordem: {
        Args: { p_auth_id: string; p_empresa_id: string }
        Returns: number
      }
      is_superior_of: {
        Args: { p_auth_id: string; p_target_empresa_usuario_id: string }
        Returns: boolean
      }
    }
  }
}

export interface Empresa {
  id: string
  nome: string
  cnpj: string
  created_at: string
}

export interface Hierarquia {
  id: string
  empresa_id: string
  nome: string
  ordem: number
  descricao: string | null
  ativo: boolean
  created_at: string
}

export interface Usuario {
  id: string
  auth_id: string
  nome: string
  email: string
  telefone: string | null
  is_master: boolean
  created_at: string
}

export interface EmpresaUsuario {
  id: string
  empresa_id: string
  usuario_id: string
  hierarquia_id: string
  superior_id: string | null
  comissao_percentual: number
  ativo: boolean
  created_at: string
  // Joined fields
  usuario?: Usuario
  hierarquia?: Hierarquia
  empresa?: Empresa
  superior?: EmpresaUsuario
}

export interface Categoria {
  id: string
  empresa_id: string
  nome: string
  created_at: string
}

export interface Produto {
  id: string
  empresa_id: string
  nome: string
  sku: string
  descricao: string | null
  categoria_id: string | null
  unidade_medida: string
  preco_custo: number
  preco_venda: number
  estoque_minimo: number
  foto_url: string | null
  ativo: boolean
  created_at: string
  // Joined/computed
  categoria?: Categoria
  estoque_atual?: number
}

export interface EstoqueMovimentacao {
  id: string
  produto_id: string
  empresa_id: string
  tipo: 'entrada' | 'saida' | 'ajuste' | 'cancelamento'
  quantidade: number
  pedido_id: string | null
  usuario_id: string
  observacao: string | null
  created_at: string
  // Joined
  produto?: Produto
  usuario?: Usuario
}

export interface Pedido {
  id: string
  empresa_id: string
  usuario_id: string
  cliente_id: string | null
  status: 'rascunho' | 'confirmado' | 'entregue' | 'cancelado'
  valor_total: number
  observacao: string | null
  created_at: string
  updated_at: string
  // Joined
  itens?: PedidoItem[]
  usuario?: Usuario
  cliente?: Cliente
}

export interface PedidoItem {
  id: string
  pedido_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  // Joined
  produto?: Produto
}

export interface Cliente {
  id: string
  empresa_id: string
  nome: string
  cnpj: string | null
  cep: string | null
  telefone: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  observacao: string | null
  vendedor_id: string | null
  ativo: boolean
  created_at: string
  // Joined
  vendedor?: Usuario
}
