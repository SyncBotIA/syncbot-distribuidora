-- =============================================================================
-- Schema SQL - Sistema de Gestão de Distribuidora
-- Supabase / PostgreSQL
-- =============================================================================

-- =====================
-- TABELAS
-- =====================

-- Empresas cadastradas no sistema
CREATE TABLE empresas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text        NOT NULL,
  cnpj       text,
  created_at timestamptz DEFAULT now()
);

-- Níveis hierárquicos dentro de cada empresa (ordem 1 = mais alto)
CREATE TABLE hierarquias (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid        NOT NULL REFERENCES empresas (id),
  nome       text        NOT NULL,
  ordem      integer     NOT NULL,
  descricao  text,
  ativo      boolean     DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, ordem)
);

-- Usuários do sistema (ligados ao auth.users do Supabase)
CREATE TABLE usuarios (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id    uuid        NOT NULL UNIQUE,
  nome       text        NOT NULL,
  email      text        NOT NULL,
  telefone   text,
  created_at timestamptz DEFAULT now()
);

-- Vínculo entre usuário, empresa e hierarquia
CREATE TABLE empresa_usuarios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid        NOT NULL REFERENCES empresas (id),
  usuario_id    uuid        NOT NULL REFERENCES usuarios (id),
  hierarquia_id uuid        NOT NULL REFERENCES hierarquias (id),
  superior_id   uuid        REFERENCES empresa_usuarios (id),
  ativo         boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (empresa_id, usuario_id)
);

-- Categorias de produtos
CREATE TABLE categorias (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid        NOT NULL REFERENCES empresas (id),
  nome       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Produtos da distribuidora
CREATE TABLE produtos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid        NOT NULL REFERENCES empresas (id),
  nome            text        NOT NULL,
  sku             text        NOT NULL,
  descricao       text,
  categoria_id    uuid        REFERENCES categorias (id),
  unidade_medida  text        NOT NULL,
  preco_custo     numeric     NOT NULL DEFAULT 0,
  preco_venda     numeric     NOT NULL DEFAULT 0,
  estoque_minimo  integer     DEFAULT 0,
  foto_url        text,
  ativo           boolean     DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Pedidos feitos por usuários
CREATE TABLE pedidos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid        NOT NULL REFERENCES empresas (id),
  usuario_id  uuid        NOT NULL REFERENCES usuarios (id),
  status      text        NOT NULL DEFAULT 'rascunho'
              CHECK (status IN ('rascunho', 'confirmado', 'entregue', 'cancelado')),
  valor_total numeric     DEFAULT 0,
  observacao  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Itens de cada pedido
CREATE TABLE pedido_itens (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id      uuid    NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  produto_id     uuid    NOT NULL REFERENCES produtos (id),
  quantidade     integer NOT NULL,
  preco_unitario numeric NOT NULL,
  subtotal       numeric NOT NULL
);

-- Movimentações de estoque
CREATE TABLE estoque_movimentacoes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid        NOT NULL REFERENCES produtos (id),
  empresa_id uuid        NOT NULL REFERENCES empresas (id),
  tipo       text        NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'cancelamento')),
  quantidade integer     NOT NULL,
  pedido_id  uuid        REFERENCES pedidos (id),
  usuario_id uuid        NOT NULL REFERENCES usuarios (id),
  observacao text,
  created_at timestamptz DEFAULT now()
);

-- =====================
-- ÍNDICES
-- =====================

-- Hierarquias
CREATE INDEX idx_hierarquias_empresa_id ON hierarquias (empresa_id);

-- Empresa-Usuários
CREATE INDEX idx_empresa_usuarios_empresa_id    ON empresa_usuarios (empresa_id);
CREATE INDEX idx_empresa_usuarios_usuario_id    ON empresa_usuarios (usuario_id);
CREATE INDEX idx_empresa_usuarios_hierarquia_id ON empresa_usuarios (hierarquia_id);
CREATE INDEX idx_empresa_usuarios_superior_id   ON empresa_usuarios (superior_id);

-- Categorias
CREATE INDEX idx_categorias_empresa_id ON categorias (empresa_id);

-- Produtos
CREATE INDEX idx_produtos_empresa_id   ON produtos (empresa_id);
CREATE INDEX idx_produtos_categoria_id ON produtos (categoria_id);
CREATE INDEX idx_produtos_sku          ON produtos (sku);

-- Pedidos
CREATE INDEX idx_pedidos_empresa_id  ON pedidos (empresa_id);
CREATE INDEX idx_pedidos_usuario_id  ON pedidos (usuario_id);
CREATE INDEX idx_pedidos_status      ON pedidos (status);

-- Pedido Itens
CREATE INDEX idx_pedido_itens_pedido_id  ON pedido_itens (pedido_id);
CREATE INDEX idx_pedido_itens_produto_id ON pedido_itens (produto_id);

-- Estoque Movimentações
CREATE INDEX idx_estoque_mov_produto_id ON estoque_movimentacoes (produto_id);
CREATE INDEX idx_estoque_mov_empresa_id ON estoque_movimentacoes (empresa_id);
CREATE INDEX idx_estoque_mov_pedido_id  ON estoque_movimentacoes (pedido_id);
CREATE INDEX idx_estoque_mov_usuario_id ON estoque_movimentacoes (usuario_id);
CREATE INDEX idx_estoque_mov_tipo       ON estoque_movimentacoes (tipo);

-- =====================
-- TRIGGER: atualizar updated_at em pedidos
-- =====================

CREATE OR REPLACE FUNCTION trg_update_pedidos_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_pedidos_updated_at();

-- =====================
-- FUNÇÕES SQL
-- =====================

-- 1. Retorna todos os IDs de subordinados diretos e indiretos
CREATE OR REPLACE FUNCTION get_subordinados(p_empresa_usuario_id uuid)
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE subordinados AS (
    -- Subordinados diretos
    SELECT eu.id
    FROM empresa_usuarios eu
    WHERE eu.superior_id = p_empresa_usuario_id

    UNION ALL

    -- Subordinados indiretos (recursivo)
    SELECT eu.id
    FROM empresa_usuarios eu
    INNER JOIN subordinados s ON eu.superior_id = s.id
  )
  SELECT id FROM subordinados;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Retorna a ordem hierárquica do usuário na empresa
CREATE OR REPLACE FUNCTION get_user_hierarquia_ordem(p_auth_id uuid, p_empresa_id uuid)
RETURNS integer AS $$
DECLARE
  v_ordem integer;
BEGIN
  SELECT h.ordem INTO v_ordem
  FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  JOIN hierarquias h ON h.id = eu.hierarquia_id
  WHERE u.auth_id = p_auth_id
    AND eu.empresa_id = p_empresa_id
  LIMIT 1;

  RETURN v_ordem;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Verifica se o usuário é superior direto ou indireto do alvo
CREATE OR REPLACE FUNCTION is_superior_of(p_auth_id uuid, p_target_empresa_usuario_id uuid)
RETURNS boolean AS $$
DECLARE
  v_empresa_usuario_id uuid;
BEGIN
  -- Buscar o empresa_usuario_id do usuário autenticado na mesma empresa do alvo
  SELECT eu.id INTO v_empresa_usuario_id
  FROM empresa_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  WHERE u.auth_id = p_auth_id
    AND eu.empresa_id = (
      SELECT empresa_id FROM empresa_usuarios WHERE id = p_target_empresa_usuario_id
    )
  LIMIT 1;

  IF v_empresa_usuario_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar se o alvo está na árvore de subordinados
  RETURN EXISTS (
    SELECT 1
    FROM get_subordinados(v_empresa_usuario_id) sub_id
    WHERE sub_id = p_target_empresa_usuario_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Retorna o estoque atual de um produto
--    entrada e cancelamento somam; saida subtrai; ajuste define o valor absoluto
CREATE OR REPLACE FUNCTION get_estoque_atual(p_produto_id uuid)
RETURNS integer AS $$
DECLARE
  v_estoque integer := 0;
  v_ultimo_ajuste_id uuid;
  v_quantidade_ajuste integer;
BEGIN
  -- Verificar se existe algum ajuste (pegar o mais recente)
  SELECT id, quantidade INTO v_ultimo_ajuste_id, v_quantidade_ajuste
  FROM estoque_movimentacoes
  WHERE produto_id = p_produto_id AND tipo = 'ajuste'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_ultimo_ajuste_id IS NOT NULL THEN
    -- Começar do valor do último ajuste e somar movimentações posteriores
    v_estoque := v_quantidade_ajuste;

    SELECT v_estoque + COALESCE(SUM(
      CASE
        WHEN tipo IN ('entrada', 'cancelamento') THEN quantidade
        WHEN tipo = 'saida' THEN -quantidade
        ELSE 0
      END
    ), 0) INTO v_estoque
    FROM estoque_movimentacoes
    WHERE produto_id = p_produto_id
      AND tipo != 'ajuste'
      AND created_at > (
        SELECT created_at FROM estoque_movimentacoes WHERE id = v_ultimo_ajuste_id
      );
  ELSE
    -- Sem ajustes: somar todas as movimentações
    SELECT COALESCE(SUM(
      CASE
        WHEN tipo IN ('entrada', 'cancelamento') THEN quantidade
        WHEN tipo = 'saida' THEN -quantidade
        ELSE 0
      END
    ), 0) INTO v_estoque
    FROM estoque_movimentacoes
    WHERE produto_id = p_produto_id;
  END IF;

  RETURN v_estoque;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================
-- ROW LEVEL SECURITY (RLS)
-- =====================

-- Habilitar RLS em todas as tabelas
ALTER TABLE empresas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hierarquias            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- EMPRESAS
-- Leitura: usuários que pertencem à empresa
-- Inserção: qualquer usuário autenticado
-- ---------------------------------------------------------

CREATE POLICY empresas_select ON empresas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = empresas.id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY empresas_insert ON empresas
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- ---------------------------------------------------------
-- HIERARQUIAS
-- Leitura: qualquer usuário da empresa
-- Escrita (INSERT/UPDATE/DELETE): apenas usuários com ordem = 1
-- ---------------------------------------------------------

CREATE POLICY hierarquias_select ON hierarquias
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = hierarquias.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY hierarquias_insert ON hierarquias
  FOR INSERT WITH CHECK (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
  );

CREATE POLICY hierarquias_update ON hierarquias
  FOR UPDATE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
  );

CREATE POLICY hierarquias_delete ON hierarquias
  FOR DELETE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
  );

-- ---------------------------------------------------------
-- USUARIOS
-- Leitura: próprio registro
-- Inserção: qualquer usuário autenticado
-- ---------------------------------------------------------

CREATE POLICY usuarios_select ON usuarios
  FOR SELECT USING (
    auth_id = auth.uid()
  );

CREATE POLICY usuarios_insert ON usuarios
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- ---------------------------------------------------------
-- EMPRESA_USUARIOS
-- Leitura: usuários da mesma empresa (filtrado por árvore de subordinados para não-admin)
-- Inserção/Atualização: apenas superiores
-- ---------------------------------------------------------

CREATE POLICY empresa_usuarios_select ON empresa_usuarios
  FOR SELECT USING (
    -- Próprio registro
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = empresa_usuarios.usuario_id
        AND u.auth_id = auth.uid()
    )
    OR
    -- Admin (ordem 1) vê todos da empresa
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
    OR
    -- Superiores veem subordinados
    EXISTS (
      SELECT 1 FROM empresa_usuarios meu
      JOIN usuarios u ON u.id = meu.usuario_id
      WHERE u.auth_id = auth.uid()
        AND meu.empresa_id = empresa_usuarios.empresa_id
        AND empresa_usuarios.id IN (SELECT get_subordinados(meu.id))
    )
  );

CREATE POLICY empresa_usuarios_insert ON empresa_usuarios
  FOR INSERT WITH CHECK (
    -- Admin pode inserir qualquer um
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
    OR
    -- Superior pode inserir subordinados (superior_id aponta para si)
    EXISTS (
      SELECT 1 FROM empresa_usuarios meu
      JOIN usuarios u ON u.id = meu.usuario_id
      WHERE u.auth_id = auth.uid()
        AND meu.empresa_id = empresa_usuarios.empresa_id
        AND empresa_usuarios.superior_id = meu.id
    )
  );

CREATE POLICY empresa_usuarios_update ON empresa_usuarios
  FOR UPDATE USING (
    -- Admin pode atualizar qualquer um
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
    OR
    -- Superior direto ou indireto pode atualizar
    is_superior_of(auth.uid(), empresa_usuarios.id)
  );

-- ---------------------------------------------------------
-- CATEGORIAS
-- Leitura: qualquer usuário da empresa
-- Escrita: ordem 1 e 2
-- ---------------------------------------------------------

CREATE POLICY categorias_select ON categorias
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = categorias.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY categorias_insert ON categorias
  FOR INSERT WITH CHECK (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

CREATE POLICY categorias_update ON categorias
  FOR UPDATE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

CREATE POLICY categorias_delete ON categorias
  FOR DELETE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

-- ---------------------------------------------------------
-- PRODUTOS
-- Leitura: qualquer usuário da empresa
-- Escrita: ordem 1 e 2
-- ---------------------------------------------------------

CREATE POLICY produtos_select ON produtos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = produtos.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY produtos_insert ON produtos
  FOR INSERT WITH CHECK (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

CREATE POLICY produtos_update ON produtos
  FOR UPDATE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

CREATE POLICY produtos_delete ON produtos
  FOR DELETE USING (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

-- ---------------------------------------------------------
-- ESTOQUE_MOVIMENTACOES
-- Leitura: qualquer usuário da empresa
-- Inserção: ordem 1 e 2
-- ---------------------------------------------------------

CREATE POLICY estoque_mov_select ON estoque_movimentacoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = estoque_movimentacoes.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY estoque_mov_insert ON estoque_movimentacoes
  FOR INSERT WITH CHECK (
    get_user_hierarquia_ordem(auth.uid(), empresa_id) IN (1, 2)
  );

-- ---------------------------------------------------------
-- PEDIDOS
-- Leitura: próprios pedidos + pedidos de subordinados
-- Inserção: qualquer usuário autenticado da empresa
-- Atualização: criador do pedido ou superior
-- ---------------------------------------------------------

CREATE POLICY pedidos_select ON pedidos
  FOR SELECT USING (
    -- Próprios pedidos
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = pedidos.usuario_id
        AND u.auth_id = auth.uid()
    )
    OR
    -- Admin vê todos da empresa
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
    OR
    -- Superior vê pedidos de subordinados
    EXISTS (
      SELECT 1 FROM empresa_usuarios meu
      JOIN usuarios u ON u.id = meu.usuario_id
      WHERE u.auth_id = auth.uid()
        AND meu.empresa_id = pedidos.empresa_id
        AND (
          SELECT eu.id FROM empresa_usuarios eu
          WHERE eu.usuario_id = pedidos.usuario_id
            AND eu.empresa_id = pedidos.empresa_id
          LIMIT 1
        ) IN (SELECT get_subordinados(meu.id))
    )
  );

CREATE POLICY pedidos_insert ON pedidos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresa_usuarios eu
      JOIN usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = pedidos.empresa_id
        AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY pedidos_update ON pedidos
  FOR UPDATE USING (
    -- Criador do pedido
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = pedidos.usuario_id
        AND u.auth_id = auth.uid()
    )
    OR
    -- Superior do criador
    EXISTS (
      SELECT 1 FROM empresa_usuarios meu
      JOIN usuarios u ON u.id = meu.usuario_id
      WHERE u.auth_id = auth.uid()
        AND meu.empresa_id = pedidos.empresa_id
        AND (
          SELECT eu.id FROM empresa_usuarios eu
          WHERE eu.usuario_id = pedidos.usuario_id
            AND eu.empresa_id = pedidos.empresa_id
          LIMIT 1
        ) IN (SELECT get_subordinados(meu.id))
    )
    OR
    get_user_hierarquia_ordem(auth.uid(), empresa_id) = 1
  );

-- ---------------------------------------------------------
-- PEDIDO_ITENS
-- Leitura: se pode ler o pedido pai
-- Inserção/Atualização: se pode modificar o pedido pai
-- ---------------------------------------------------------

CREATE POLICY pedido_itens_select ON pedido_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_itens.pedido_id
      -- A policy do pedido já filtra a visibilidade
    )
  );

CREATE POLICY pedido_itens_insert ON pedido_itens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = pedido_itens.pedido_id
        AND (
          u.auth_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM empresa_usuarios meu
            JOIN usuarios mu ON mu.id = meu.usuario_id
            WHERE mu.auth_id = auth.uid()
              AND meu.empresa_id = p.empresa_id
              AND (
                SELECT eu.id FROM empresa_usuarios eu
                WHERE eu.usuario_id = p.usuario_id
                  AND eu.empresa_id = p.empresa_id
                LIMIT 1
              ) IN (SELECT get_subordinados(meu.id))
          )
          OR get_user_hierarquia_ordem(auth.uid(), p.empresa_id) = 1
        )
    )
  );

CREATE POLICY pedido_itens_update ON pedido_itens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = pedido_itens.pedido_id
        AND (
          u.auth_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM empresa_usuarios meu
            JOIN usuarios mu ON mu.id = meu.usuario_id
            WHERE mu.auth_id = auth.uid()
              AND meu.empresa_id = p.empresa_id
              AND (
                SELECT eu.id FROM empresa_usuarios eu
                WHERE eu.usuario_id = p.usuario_id
                  AND eu.empresa_id = p.empresa_id
                LIMIT 1
              ) IN (SELECT get_subordinados(meu.id))
          )
          OR get_user_hierarquia_ordem(auth.uid(), p.empresa_id) = 1
        )
    )
  );

CREATE POLICY pedido_itens_delete ON pedido_itens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = pedido_itens.pedido_id
        AND (
          u.auth_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM empresa_usuarios meu
            JOIN usuarios mu ON mu.id = meu.usuario_id
            WHERE mu.auth_id = auth.uid()
              AND meu.empresa_id = p.empresa_id
              AND (
                SELECT eu.id FROM empresa_usuarios eu
                WHERE eu.usuario_id = p.usuario_id
                  AND eu.empresa_id = p.empresa_id
                LIMIT 1
              ) IN (SELECT get_subordinados(meu.id))
          )
          OR get_user_hierarquia_ordem(auth.uid(), p.empresa_id) = 1
        )
    )
  );
