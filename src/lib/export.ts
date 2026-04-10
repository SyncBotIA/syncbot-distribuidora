/**
 * Utilitários de exportação CSV/Excel
 */

interface ExportColumn {
  key: string
  label: string
  format?: (value: unknown) => string
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part]
    return undefined
  }, obj)
}

function fmtDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function fmtCurrency(value: number | null): string {
  if (value === null || value === undefined) return ''
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExportColumn[]
): void {
  const BOM = '\uFEFF'
  const header = columns.map(c => escapeCSV(c.label)).join(';')
  const rows = data.map(row =>
    columns.map(col => {
      const value = getNestedValue(row, col.key)
      if (col.format) return escapeCSV(col.format(value))
      return escapeCSV(value)
    }).join(';')
  )
  const csv = BOM + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const today = new Date().toISOString().split('T')[0]
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${today}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export const pedidoColumns: ExportColumn[] = [
  { key: 'id', label: 'ID', format: (v) => String(v).slice(0, 8) },
  { key: 'usuario.nome', label: 'Vendedor' },
  { key: 'cliente.nome', label: 'Cliente' },
  { key: 'status', label: 'Status' },
  { key: 'valor_total', label: 'Valor Total', format: (v) => fmtCurrency(v as number) },
  { key: 'created_at', label: 'Data', format: (v) => fmtDate(v as string) },
]

export const produtoColumns: ExportColumn[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'nome', label: 'Nome' },
  { key: 'categoria.nome', label: 'Categoria' },
  { key: 'preco_custo', label: 'Preco Custo', format: (v) => fmtCurrency(v as number) },
  { key: 'preco_venda', label: 'Preco Venda', format: (v) => fmtCurrency(v as number) },
  { key: 'estoque_atual', label: 'Estoque' },
]

export const clienteColumns: ExportColumn[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'bairro', label: 'Bairro' },
]
