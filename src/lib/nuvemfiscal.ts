/**
 * Integração com a API Nuvem Fiscal (Sandbox/Produção)
 * Documentação: https://dev.nuvemfiscal.com.br/docs/
 */

const API_URL = import.meta.env.VITE_NUVEMFISCAL_API_URL
const AUTH_URL = import.meta.env.VITE_NUVEMFISCAL_AUTH_URL
const CLIENT_ID = import.meta.env.VITE_NUVEMFISCAL_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_NUVEMFISCAL_CLIENT_SECRET
const AMBIENTE = import.meta.env.VITE_NUVEMFISCAL_AMBIENTE || 'homologacao'
const UF_EMITENTE = import.meta.env.VITE_NUVEMFISCAL_UF || 'PR'

// Cache do token OAuth
let cachedToken: { access_token: string; expires_at: number } | null = null

/**
 * Obtém token OAuth2 (client_credentials)
 */
async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'empresa nfe cnpj',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erro ao autenticar na Nuvem Fiscal: ${text}`)
  }

  const data = await res.json()
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000, // margem de 60s
  }
  return data.access_token
}

/**
 * Faz requisição autenticada à API
 */
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}

/**
 * Lê o body de erro de forma segura (pode ser JSON ou texto)
 */
async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const json = JSON.parse(text)
    return json.error?.message || json.message || text
  } catch {
    return text
  }
}

// ==========================================
// Empresa
// ==========================================

/**
 * Cadastra a empresa emissora na Nuvem Fiscal (se ainda não existir)
 */
export async function cadastrarEmpresa(dados: {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  inscricao_estadual: string
  endereco: {
    logradouro: string
    numero: string
    bairro: string
    codigo_municipio: string
    nome_municipio: string
    uf: string
    cep: string
  }
  email?: string
}) {
  // Verificar se já existe
  const check = await apiFetch(`/empresas/${dados.cnpj}`)
  if (check.ok) {
    return await check.json()
  }

  const body = {
    cpf_cnpj: dados.cnpj,
    nome_razao_social: dados.razao_social,
    nome_fantasia: dados.nome_fantasia || dados.razao_social,
    inscricao_estadual: dados.inscricao_estadual,
    email: dados.email || 'nfe@empresa.com.br',
    endereco: {
      logradouro: dados.endereco.logradouro,
      numero: dados.endereco.numero,
      bairro: dados.endereco.bairro,
      codigo_municipio: dados.endereco.codigo_municipio,
      uf: dados.endereco.uf,
      cep: dados.endereco.cep,
      codigo_pais: '1058',
      pais: 'Brasil',
    },
    optante_simples_nacional: true,
  }

  const res = await apiFetch('/empresas', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const msg = await readErrorBody(res)
    throw new Error(msg || 'Erro ao cadastrar empresa')
  }

  return await res.json()
}

// ==========================================
// NF-e
// ==========================================

interface NFeItem {
  numero: number
  nome: string
  ncm?: string
  cfop?: string
  unidade: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}

interface NFeDestinatario {
  cnpj_cpf?: string
  nome: string
  endereco?: {
    logradouro: string
    numero: string
    bairro: string
    codigo_municipio: string
    nome_municipio: string
    uf: string
    cep: string
  }
  indicador_inscricao_estadual?: number
}

export interface NFeEmitenteEndereco {
  logradouro: string
  numero: string
  bairro: string
  codigo_municipio: string
  nome_municipio: string
  uf: string
  cep: string
}

export interface NFeEmissaoParams {
  cnpj_emitente: string
  razao_social_emitente: string
  nome_fantasia_emitente?: string
  ie_emitente?: string
  uf_emitente?: string
  endereco_emitente?: NFeEmitenteEndereco
  numero_nf: number
  serie?: number
  natureza_operacao?: string
  destinatario?: NFeDestinatario
  itens: NFeItem[]
  valor_total: number
  forma_pagamento?: number // 0=Vista, 1=Prazo
  meio_pagamento?: number // 1=Dinheiro, 3=Cartao Credito, etc.
  informacoes_complementares?: string
}

/**
 * Emite uma NF-e via API Nuvem Fiscal
 */
export async function emitirNFe(params: NFeEmissaoParams) {
  const tpAmb = AMBIENTE === 'producao' ? 1 : 2
  const uf = params.uf_emitente || UF_EMITENTE
  const end = params.endereco_emitente
  // Código UF para NF-e
  const UF_CODES: Record<string, number> = {
    AC:12,AL:27,AP:16,AM:13,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,
    MT:51,MS:50,MG:31,PA:15,PB:25,PR:41,PE:26,PI:22,RJ:33,RN:24,
    RS:43,RO:11,RR:14,SC:42,SP:35,SE:28,TO:17,
  }
  const cUF = UF_CODES[uf] || 35
  const cMunFG = end?.codigo_municipio || '3516200'

  // Monta os itens (det)
  const det = params.itens.map((item) => ({
    nItem: item.numero,
    prod: {
      cProd: String(item.numero).padStart(4, '0'),
      cEAN: 'SEM GTIN',
      xProd: item.nome,
      NCM: item.ncm || '00000000',
      CFOP: item.cfop || '5102',
      uCom: item.unidade || 'UN',
      qCom: item.quantidade,
      vUnCom: item.valor_unitario,
      vProd: item.valor_total,
      cEANTrib: 'SEM GTIN',
      uTrib: item.unidade || 'UN',
      qTrib: item.quantidade,
      vUnTrib: item.valor_unitario,
      indTot: 1,
    },
    imposto: {
      ICMS: {
        ICMSSN102: {
          orig: 0,
          CSOSN: '102',
        },
      },
      PIS: {
        PISOutr: {
          CST: '99',
          vBC: 0,
          pPIS: 0,
          vPIS: 0,
        },
      },
      COFINS: {
        COFINSOutr: {
          CST: '99',
          vBC: 0,
          pCOFINS: 0,
          vCOFINS: 0,
        },
      },
    },
  }))

  // Monta destinatário (se houver)
  let dest = undefined
  if (params.destinatario) {
    const d = params.destinatario
    // Identificação do destinatário (CNPJ, CPF ou idEstrangeiro — obrigatório antes de xNome)
    const cpfCnpj = d.cnpj_cpf?.replace(/\D/g, '')
    const identDest = cpfCnpj && cpfCnpj.length <= 11
      ? { CPF: cpfCnpj }
      : cpfCnpj && cpfCnpj.length > 11
        ? { CNPJ: cpfCnpj }
        : { idEstrangeiro: '' }

    dest = {
      ...identDest,
      xNome: d.nome,
      indIEDest: d.indicador_inscricao_estadual ?? 9, // 9 = Não contribuinte
      ...(d.endereco
        ? {
            enderDest: {
              xLgr: d.endereco.logradouro || 'Rua Teste',
              nro: d.endereco.numero || 'S/N',
              xBairro: d.endereco.bairro || 'Centro',
              cMun: d.endereco.codigo_municipio || cMunFG,
              xMun: d.endereco.nome_municipio || end?.nome_municipio || 'Cidade',
              UF: d.endereco.uf || uf,
              CEP: d.endereco.cep || end?.cep?.replace(/\D/g, '') || '00000000',
              cPais: '1058',
              xPais: 'Brasil',
            },
          }
        : {}),
    }
  }

  const body = {
    ambiente: AMBIENTE,
    infNFe: {
      versao: '4.00',
      ide: {
        cUF,
        natOp: params.natureza_operacao || 'Venda de mercadoria',
        mod: 55, // NF-e
        serie: params.serie ?? 1,
        nNF: params.numero_nf,
        dhEmi: new Date().toISOString(),
        tpNF: 1, // 1 = Saída
        idDest: 1, // 1 = Operação interna
        cMunFG,
        tpImp: 1, // 1 = DANFE normal
        tpEmis: 1, // 1 = Emissão normal
        tpAmb,
        finNFe: 1, // 1 = Normal
        indFinal: 1, // 1 = Consumidor final
        indPres: 1, // 1 = Presencial
        procEmi: 0, // 0 = Aplicativo do contribuinte
        verProc: '1.0.0',
      },
      emit: {
        CNPJ: params.cnpj_emitente,
        xNome: params.razao_social_emitente,
        xFant: params.nome_fantasia_emitente || params.razao_social_emitente,
        ...(params.ie_emitente ? { IE: params.ie_emitente } : {}),
        CRT: 1, // 1 = Simples Nacional
        enderEmit: {
          xLgr: end?.logradouro || 'Rua Teste',
          nro: end?.numero || '100',
          xBairro: end?.bairro || 'Centro',
          cMun: cMunFG,
          xMun: end?.nome_municipio || 'Cidade',
          UF: uf,
          CEP: end?.cep?.replace(/\D/g, '') || '00000000',
          cPais: '1058',
          xPais: 'Brasil',
        },
      },
      // Destinatário (obrigatório pela SEFAZ)
      ...(dest ? { dest } : {
        dest: {
          CPF: '12345678909',
          xNome: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
          indIEDest: 9,
          enderDest: {
            xLgr: end?.logradouro || 'Rua Teste',
            nro: '1',
            xBairro: 'Centro',
            cMun: cMunFG,
            xMun: end?.nome_municipio || 'Cidade',
            UF: uf,
            CEP: end?.cep?.replace(/\D/g, '') || '00000000',
            cPais: '1058',
            xPais: 'Brasil',
          },
        },
      }),
      det,
      total: {
        ICMSTot: {
          vBC: 0,
          vICMS: 0,
          vICMSDeson: 0,
          vFCP: 0,
          vBCST: 0,
          vST: 0,
          vFCPST: 0,
          vFCPSTRet: 0,
          vProd: params.valor_total,
          vFrete: 0,
          vSeg: 0,
          vDesc: 0,
          vII: 0,
          vIPI: 0,
          vIPIDevol: 0,
          vPIS: 0,
          vCOFINS: 0,
          vOutro: 0,
          vNF: params.valor_total,
        },
      },
      transp: {
        modFrete: 9, // 9 = Sem frete
      },
      pag: {
        detPag: [
          {
            indPag: params.forma_pagamento ?? 0,
            tPag: String(params.meio_pagamento ?? 1).padStart(2, '0'),
            vPag: params.valor_total,
          },
        ],
      },
    },
  }

  const res = await apiFetch('/nfe', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const msg = await readErrorBody(res)
    console.error('[NFe] Erro ao emitir:', msg)
    throw new Error(msg || 'Erro ao emitir NF-e')
  }

  return await res.json()
}

/**
 * Consulta o status de uma NF-e
 */
export async function consultarNFe(nfeId: string) {
  const res = await apiFetch(`/nfe/${nfeId}`)
  if (!res.ok) {
    const msg = await readErrorBody(res)
    throw new Error(msg || 'Erro ao consultar NF-e')
  }
  return await res.json()
}

/**
 * Baixa o PDF (DANFE) de uma NF-e autorizada
 */
export async function baixarDANFE(nfeId: string): Promise<Blob> {
  const res = await apiFetch(`/nfe/${nfeId}/pdf`, {
    headers: { Accept: 'application/pdf' },
  })
  if (!res.ok) {
    throw new Error('Erro ao baixar DANFE')
  }
  return await res.blob()
}

/**
 * Baixa o XML de uma NF-e autorizada
 */
export async function baixarXML(nfeId: string): Promise<Blob> {
  const res = await apiFetch(`/nfe/${nfeId}/xml`, {
    headers: { Accept: 'application/xml' },
  })
  if (!res.ok) {
    throw new Error('Erro ao baixar XML')
  }
  return await res.blob()
}

/**
 * Cancela uma NF-e autorizada
 */
export async function cancelarNFe(nfeId: string, justificativa: string) {
  const res = await apiFetch(`/nfe/${nfeId}/cancelamento`, {
    method: 'POST',
    body: JSON.stringify({ justificativa }),
  })
  if (!res.ok) {
    const msg = await readErrorBody(res)
    throw new Error(msg || 'Erro ao cancelar NF-e')
  }
  return await res.json()
}

/**
 * Helper: abre blob como download
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Helper: abre blob em nova aba
 */
export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
