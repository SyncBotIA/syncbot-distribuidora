-- Apagar DUPLICATAS de empresa_usuarios, mantendo apenas o mais recente por usuario
-- Usa CTE com ROW_NUMBER para identificar duplicados

WITH ranked AS (
  SELECT id, empresa_id, usuario_id,
         ROW_NUMBER() OVER (
           PARTITION BY empresa_id, usuario_id
           ORDER BY created_at DESC
         ) as rn
  FROM empresa_usuarios
),
deletar AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM empresa_usuarios WHERE id IN (SELECT id FROM deletar);

-- Verificar resultado
SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE ativo = true) as ativos
FROM empresa_usuarios
WHERE empresa_id = '07edc359-c2f8-4dc7-8e93-42ec86af1d80';
