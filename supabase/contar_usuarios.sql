-- Ver quantos empresa_usuarios existem
SELECT COUNT(*) FROM empresa_usuarios WHERE empresa_id = '07edc359-c2f8-4dc7-8e93-42ec86af1d80';

-- Ver quantos estao ativos
SELECT COUNT(*) FROM empresa_usuarios
WHERE empresa_id = '07edc359-c2f8-4dc7-8e93-42ec86af1d80' AND ativo = true;

-- Ver todos (including inativos)
SELECT eu.id, eu.ativo, eu.created_at, u.nome, u.email
FROM empresa_usuarios eu
JOIN usuarios u ON u.id = eu.usuario_id
WHERE eu.empresa_id = '07edc359-c2f8-4dc7-8e93-42ec86af1d80'
ORDER BY eu.created_at DESC;
