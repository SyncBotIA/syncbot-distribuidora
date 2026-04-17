import * as XLSX from 'xlsx'

export interface ParsedSheet {
  headers: string[]
  rows: Record<string, unknown>[]
}

/**
 * Le um arquivo XLSX ou CSV e devolve headers + rows normalizados.
 */
export async function parseSheet(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('Arquivo vazio ou invalido')
  const sheet = workbook.Sheets[firstSheet]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  })
  const headers = Object.keys(json[0] ?? {})
  return { headers, rows: json }
}

/**
 * Remove acentos, caixa e espacos extras para comparacao robusta de nomes de coluna.
 */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Tenta identificar uma coluna pelo nome. Devolve o header original ou null.
 */
export function detectColumn(headers: string[], candidates: string[]): string | null {
  const slugs = headers.map((h) => ({ original: h, s: slug(h) }))
  for (const cand of candidates) {
    const c = slug(cand)
    const hit = slugs.find((x) => x.s === c)
    if (hit) return hit.original
  }
  // fallback: matching parcial
  for (const cand of candidates) {
    const c = slug(cand)
    const hit = slugs.find((x) => x.s.includes(c))
    if (hit) return hit.original
  }
  return null
}

/** Remove tudo que nao for digito. */
export function onlyDigits(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/\D/g, '')
}

/** Normaliza CNPJ para 14 digitos. Vazio se nao for valido. */
export function normalizeCnpj(v: unknown): string {
  const d = onlyDigits(v)
  return d.length === 14 ? d : ''
}

/** Normaliza CEP para 8 digitos. */
export function normalizeCep(v: unknown): string {
  const d = onlyDigits(v)
  return d.length === 8 ? d : ''
}

/** Aceita "R$ 1.234,56", "1234.56", 1234.56. Retorna number ou 0. */
export function normalizeMoney(v: unknown): number {
  if (typeof v === 'number') return v
  if (v === null || v === undefined) return 0
  const s = String(v).trim()
  if (!s) return 0
  // remove simbolos de moeda e espacos
  const cleaned = s.replace(/[^\d,.-]/g, '')
  // se tiver virgula e ponto, assume padrao BR (ponto = milhar, virgula = decimal)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  // so virgula -> decimal BR
  if (cleaned.includes(',')) {
    const n = parseFloat(cleaned.replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

/** Converte valor em string preservando null/undefined como null. */
export function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Converte valor em integer ou null. */
export function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = parseInt(String(v).replace(/\D/g, ''), 10)
  return isNaN(n) ? null : n
}
