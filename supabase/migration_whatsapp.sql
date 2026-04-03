-- =============================================================================
-- Migration: Automação WhatsApp + N8N
-- Novas tabelas, colunas e funções RPC para integração com WhatsApp
-- =============================================================================

-- =====================
-- NOVA TABELA: clientes (compradores da distribuidora)
-- =====================

CREATE TABLE clientes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid        NOT NULL REFERENCES empresas (id),
  nome         text        NOT NULL,
  telefone     text,
  endereco     text,
  bairro       text,
  cidade       text,
  observacao   text,
  vendedor_id  uuid        REFERENCES usuarios (id),
  ativo        boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_clientes_empresa_id   ON clientes (empresa_id);
CREATE INDEX idx_clientes_vendedor_id  ON clientes (vendedor_id);
CREATE INDEX idx_clientes_telefone     ON clientes (telefone);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário da empresa
CREATE POLICY clientes_select ON clientes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = clientes.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

-- Inserção: qualquer usuário da empresa
CREATE POLICY clientes_insert ON clientes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = clientes.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

-- Atualização: qualquer usuário da empresa
CREATE POLICY clientes_update ON clientes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = clientes.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

-- Exclusão: ordem 1 e 2
CREATE POLICY clientes_delete ON clientes
  FOR DELETE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

-- =====================
-- ALTERAR TABELA: pedidos — adicionar cliente_id
-- =====================

ALTER TABLE pedidos ADD COLUMN cliente_id uuid REFERENCES clientes (id);
CREATE INDEX idx_pedidos_cliente_id ON pedidos (cliente_id);

-- =====================
-- ALTERAR TABELA: empresa_usuarios — adicionar comissao_percentual
-- =====================

ALTER TABLE empresa_usuarios ADD COLUMN comissao_percentual numeric DEFAULT 0;

-- =====================
-- NOVA TABELA: conversas_whatsapp (estado do bot)
-- =====================

CREATE TABLE conversas_whatsapp (
  telefone   text        PRIMARY KEY,
  estado     text        NOT NULL DEFAULT 'idle',
  dados      jsonb       DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Sem RLS — acessada apenas pelo service_role via N8N

-- =====================
-- FUNÇÕES RPC PARA N8N
-- =====================

-- 1. Identificar vendedor pelo telefone
CREATE OR REPLACE FUNCTION get_vendedor_by_telefone(p_telefone text)
RETURNS TABLE (
  usuario_id uuid,
  usuario_nome text,
  empresa_id uuid,
  empresa_nome text,
  empresa_usuario_id uuid,
  hierarquia_ordem integer,
  comissao_percentual numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS usuario_id,
    u.nome AS usuario_nome,
    e.id AS empresa_id,
    e.nome AS empresa_nome,
    eu.id AS empresa_usuario_id,
    h.ordem AS hierarquia_ordem,
    eu.comissao_percentual
  FROM usuarios u
  JOIN empresa_usuarios eu ON eu.usuario_id = u.id AND eu.ativo = true
  JOIN empresas e ON e.id = eu.empresa_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE u.telefone = p_telefone;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Listar clientes de um vendedor
CREATE OR REPLACE FUNCTION get_clientes_do_vendedor(p_vendedor_id uuid, p_empresa_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  endereco text,
  bairro text,
  cidade text
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.nome, c.telefone, c.endereco, c.bairro, c.cidade
  FROM clientes c
  WHERE c.empresa_id = p_empresa_id
    AND c.vendedor_id = p_vendedor_id
    AND c.ativo = true
  ORDER BY c.nome;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Listar produtos ativos com estoque
CREATE OR REPLACE FUNCTION get_produtos_ativos(p_empresa_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  sku text,
  preco_venda numeric,
  unidade_medida text,
  categoria_nome text,
  estoque_atual integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.nome, p.sku, p.preco_venda, p.unidade_medida,
    COALESCE(cat.nome, 'Sem categoria') AS categoria_nome,
    get_estoque_atual(p.id) AS estoque_atual
  FROM produtos p
  LEFT JOIN categorias cat ON cat.id = p.categoria_id
  WHERE p.empresa_id = p_empresa_id
    AND p.ativo = true
    AND get_estoque_atual(p.id) > 0
  ORDER BY COALESCE(cat.nome, 'ZZZ'), p.nome;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Criar pedido completo (atômico) — usado pelo N8N via WhatsApp
CREATE OR REPLACE FUNCTION criar_pedido_completo(
  p_vendedor_id uuid,
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_itens jsonb,  -- Array de {"produto_id": "uuid", "quantidade": 5}
  p_observacao text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_pedido_id uuid;
  v_valor_total numeric := 0;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade integer;
  v_preco numeric;
  v_estoque integer;
BEGIN
  -- Validar estoque de todos os itens antes de prosseguir
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::integer;
    v_estoque := get_estoque_atual(v_produto_id);

    IF v_estoque < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para produto %: disponível=%, solicitado=%',
        (SELECT nome FROM produtos WHERE id = v_produto_id), v_estoque, v_quantidade;
    END IF;
  END LOOP;

  -- Criar pedido como 'confirmado' (WhatsApp já tem confirmação do vendedor)
  INSERT INTO pedidos (empresa_id, usuario_id, cliente_id, status, valor_total, observacao)
  VALUES (p_empresa_id, p_vendedor_id, p_cliente_id, 'confirmado', 0, p_observacao)
  RETURNING id INTO v_pedido_id;

  -- Inserir itens e criar movimentações de estoque
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::integer;

    SELECT preco_venda INTO v_preco FROM produtos WHERE id = v_produto_id;

    -- Inserir item do pedido
    INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_pedido_id, v_produto_id, v_quantidade, v_preco, v_quantidade * v_preco);

    v_valor_total := v_valor_total + (v_quantidade * v_preco);

    -- Dar baixa no estoque
    INSERT INTO estoque_movimentacoes (produto_id, empresa_id, tipo, quantidade, pedido_id, usuario_id, observacao)
    VALUES (v_produto_id, p_empresa_id, 'saida', v_quantidade, v_pedido_id, p_vendedor_id, 'Pedido via WhatsApp');
  END LOOP;

  -- Atualizar valor total do pedido
  UPDATE pedidos SET valor_total = v_valor_total WHERE id = v_pedido_id;

  RETURN v_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Relatório de vendas do vendedor
CREATE OR REPLACE FUNCTION get_relatorio_vendedor(
  p_vendedor_id uuid,
  p_empresa_id uuid,
  p_periodo text  -- 'dia', 'semana', 'mes', 'ano'
)
RETURNS TABLE (
  total_pedidos bigint,
  valor_total numeric,
  comissao numeric,
  pedidos_json jsonb
) AS $$
DECLARE
  v_data_inicio timestamptz;
  v_comissao_pct numeric;
BEGIN
  -- Determinar data de início baseado no período
  v_data_inicio := CASE p_periodo
    WHEN 'dia'    THEN date_trunc('day', now())
    WHEN 'semana' THEN date_trunc('week', now())
    WHEN 'mes'    THEN date_trunc('month', now())
    WHEN 'ano'    THEN date_trunc('year', now())
    ELSE date_trunc('month', now())
  END;

  -- Buscar percentual de comissão
  SELECT eu.comissao_percentual INTO v_comissao_pct
  FROM empresa_usuarios eu
  WHERE eu.usuario_id = p_vendedor_id AND eu.empresa_id = p_empresa_id
  LIMIT 1;

  RETURN QUERY
  SELECT
    COUNT(p.id) AS total_pedidos,
    COALESCE(SUM(p.valor_total), 0) AS valor_total,
    COALESCE(SUM(p.valor_total), 0) * COALESCE(v_comissao_pct, 0) / 100 AS comissao,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'pedido_id', p.id,
          'cliente', COALESCE(c.nome, 'Sem cliente'),
          'valor', p.valor_total,
          'status', p.status,
          'data', p.created_at,
          'itens', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'produto', pr.nome,
                'quantidade', pi.quantidade,
                'subtotal', pi.subtotal
              )
            )
            FROM pedido_itens pi
            JOIN produtos pr ON pr.id = pi.produto_id
            WHERE pi.pedido_id = p.id
          )
        )
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'::jsonb
    ) AS pedidos_json
  FROM pedidos p
  LEFT JOIN clientes c ON c.id = p.cliente_id
  WHERE p.usuario_id = p_vendedor_id
    AND p.empresa_id = p_empresa_id
    AND p.status IN ('confirmado', 'entregue')
    AND p.created_at >= v_data_inicio;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
