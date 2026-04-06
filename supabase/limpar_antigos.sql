-- Deletar registros antigos de empresa_usuarios, mantendo apenas o Rodrigo
DELETE FROM empresa_usuarios
WHERE empresa_id = '07edc359-c2f8-4dc7-8e93-42ec86af1d80'
  AND usuario_id != '92e43e9f-54c0-43ac-9d23-b3e54c0f1f57';

-- Verificar resultado
SELECT eu.id, u.nome
FROM empresa_usuarios eu
JOIN usuarios u ON u.id = eu.usuario_id
WHERE eu.empresa_id = '07edc359-c2f8-4dc7-8e93-42ec86af1d80' AND eu.ativo = true;
