-- Diagnóstico direto: ver dados da empresa

-- 1. Quantas empresas existem?
SELECT id, nome, cnpj, created_at FROM empresas LIMIT 5;

-- 2. Quantos empresa_usuarios existem para essa empresa?
-- Substitua com o ID real da empresa
SELECT eu.id, eu.empresa_id, eu.usuario_id, eu.hierarquia_id, eu.ativo
FROM empresa_usuarios eu
LIMIT 20;

-- 3. Quantos usuarios existem?
SELECT id, auth_id, nome, email, telefone, is_master, senha_provisoria FROM usuarios LIMIT 20;
