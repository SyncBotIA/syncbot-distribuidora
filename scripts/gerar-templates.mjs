import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '..', 'public', 'templates')

function buildWorkbook({ sheetName, headers, exampleRows, instructions, colWidths }) {
  const wb = XLSX.utils.book_new()

  // Aba principal
  const aoa = [headers, ...exampleRows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = colWidths.map((w) => ({ wch: w }))

  // Estilo básico não é suportado pela build community do xlsx, então só seta freeze
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Aba de instruções
  const instAoa = instructions.map((l) => [l])
  const wsInst = XLSX.utils.aoa_to_sheet(instAoa)
  wsInst['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucoes')

  return wb
}

// ========= 1) Fornecedores =========
{
  const headers = [
    'razao_social', 'nome_fantasia', 'cnpj', 'inscricao_estadual',
    'email', 'telefone', 'celular', 'contato_nome',
    'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf',
    'site', 'banco', 'agencia', 'conta', 'chave_pix',
    'prazo_pagamento_dias', 'valor_minimo_pedido', 'observacao',
  ]
  const exampleRows = [
    [
      'Distribuidora Exemplo LTDA', 'Exemplo Distrib.', '12.345.678/0001-99', '123456789',
      'contato@exemplo.com.br', '(11) 3000-0000', '(11) 99999-0000', 'Joao da Silva',
      '01310-100', 'Av. Paulista', '1000', 'Bela Vista', 'Sao Paulo', 'SP',
      'https://exemplo.com.br', 'Banco do Brasil', '1234-5', '12345-6', 'contato@exemplo.com.br',
      30, 500.00, 'Fornecedor principal de bebidas',
    ],
    [
      'Bebidas Alpha SA', 'Alpha', '98.765.432/0001-10', '987654321',
      'vendas@alpha.com.br', '(21) 2000-1111', '(21) 98888-0000', 'Maria Souza',
      '20040-002', 'Rua da Assembleia', '50', 'Centro', 'Rio de Janeiro', 'RJ',
      '', 'Itau', '5678', '9876-5', '98765432000110',
      28, 1000.00, '',
    ],
  ]
  const colWidths = [
    30, 22, 20, 18, 28, 16, 16, 22,
    12, 28, 10, 18, 18, 6,
    26, 16, 12, 14, 26,
    12, 16, 40,
  ]
  const instructions = [
    'MODELO DE IMPORTACAO DE FORNECEDORES',
    '',
    'Preencha a aba "Fornecedores" com um fornecedor por linha. Remova as linhas de exemplo antes de importar.',
    '',
    'CAMPOS:',
    '- razao_social (OBRIGATORIO): Razao social completa.',
    '- nome_fantasia: Nome fantasia/comercial.',
    '- cnpj: CNPJ (o sistema normaliza - pode enviar com ou sem mascara).',
    '- inscricao_estadual: Inscricao estadual.',
    '- email / telefone / celular: Contatos.',
    '- contato_nome: Nome da pessoa de contato.',
    '- cep: CEP (o sistema normaliza mascara).',
    '- logradouro / numero / bairro / cidade / uf: Endereco (uf em 2 letras, ex: SP).',
    '- site: URL do site.',
    '- banco / agencia / conta / chave_pix: Dados bancarios para pagamento.',
    '- prazo_pagamento_dias: Numero inteiro de dias (ex: 30).',
    '- valor_minimo_pedido: Valor monetario (aceita "1.000,50" ou "1000.50").',
    '- observacao: Texto livre.',
    '',
    'COMO IMPORTAR:',
    '1. Acesse Fornecedores > Importar Planilha.',
    '2. Selecione este arquivo (.xlsx).',
    '3. O sistema detecta as colunas automaticamente pelo nome do cabecalho.',
    '4. Revise o preview e clique em Importar.',
  ]
  const wb = buildWorkbook({
    sheetName: 'Fornecedores', headers, exampleRows, instructions, colWidths,
  })
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const path = resolve(outDir, 'template_fornecedores.xlsx')
  writeFileSync(path, buf)
  console.log('OK:', path)
}

// ========= 2) Entrada de produtos do fornecedor =========
{
  const headers = ['codigo', 'quantidade', 'preco_unitario']
  const exampleRows = [
    ['SKU-001', 120, 8.50],
    ['SKU-002', 48, 15.90],
    ['ABC-9090', 240, 2.75],
  ]
  const colWidths = [20, 14, 18]
  const instructions = [
    'MODELO DE ENTRADA DE PRODUTOS DO FORNECEDOR (NF)',
    '',
    'Esta planilha registra itens recebidos de UM fornecedor em UMA nota fiscal.',
    'Antes de importar, o produto precisa estar VINCULADO ao fornecedor (com codigo_no_fornecedor preenchido).',
    '',
    'CAMPOS:',
    '- codigo (OBRIGATORIO): Codigo do produto NO FORNECEDOR (o mesmo salvo em Produtos > Fornecedores > "Codigo no fornecedor").',
    '                        E por este campo que o sistema localiza o produto correto.',
    '- quantidade (OBRIGATORIO): Quantidade recebida. Aceita decimal (ex: 12,5 ou 12.5).',
    '- preco_unitario (OPCIONAL): Preco de custo unitario na NF. Se vazio, usa o ultimo preco cadastrado no vinculo.',
    '',
    'COMO IMPORTAR:',
    '1. Acesse Estoque > Entrada de Fornecedor.',
    '2. Selecione o fornecedor, numero da NF e data.',
    '3. Clique em "Importar planilha" e escolha este arquivo.',
    '4. Mapeie as colunas (o sistema detecta automaticamente codigo/quantidade/preco).',
    '5. Revise o preview - linhas sem vinculo com o fornecedor aparecem como erro.',
    '6. Clique em Aplicar e depois Registrar Entrada.',
    '',
    'DICA: Se aparecer "Sem vinculo com este fornecedor", significa que o produto nao possui',
    'o codigo informado cadastrado na tela Produtos > aba Fornecedores.',
  ]
  const wb = buildWorkbook({
    sheetName: 'Entrada', headers, exampleRows, instructions, colWidths,
  })
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const path = resolve(outDir, 'template_entrada_fornecedor.xlsx')
  writeFileSync(path, buf)
  console.log('OK:', path)
}
