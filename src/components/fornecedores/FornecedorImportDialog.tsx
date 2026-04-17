import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Upload, FileSpreadsheet, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import {
  parseSheet, detectColumn, normalizeCnpj, normalizeCep, normalizeMoney,
  toIntOrNull, toStringOrNull,
} from '@/lib/xlsx-parser'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

const FIELDS: { key: string; label: string; candidates: string[]; required?: boolean }[] = [
  { key: 'razao_social', label: 'Razao Social', candidates: ['razao social', 'razaosocial', 'nome', 'empresa'], required: true },
  { key: 'nome_fantasia', label: 'Nome Fantasia', candidates: ['nome fantasia', 'fantasia', 'apelido'] },
  { key: 'cnpj', label: 'CNPJ', candidates: ['cnpj', 'documento', 'cnpj/cpf'] },
  { key: 'inscricao_estadual', label: 'Inscricao Estadual', candidates: ['inscricao estadual', 'ie', 'inscricaoestadual'] },
  { key: 'email', label: 'Email', candidates: ['email', 'e-mail', 'mail'] },
  { key: 'telefone', label: 'Telefone', candidates: ['telefone', 'tel', 'fone'] },
  { key: 'celular', label: 'Celular', candidates: ['celular', 'whatsapp', 'cel'] },
  { key: 'contato_nome', label: 'Contato', candidates: ['contato', 'nome contato', 'responsavel'] },
  { key: 'cep', label: 'CEP', candidates: ['cep'] },
  { key: 'logradouro', label: 'Logradouro', candidates: ['logradouro', 'endereco', 'rua'] },
  { key: 'numero', label: 'Numero', candidates: ['numero', 'num'] },
  { key: 'bairro', label: 'Bairro', candidates: ['bairro'] },
  { key: 'cidade', label: 'Cidade', candidates: ['cidade', 'municipio'] },
  { key: 'uf', label: 'UF', candidates: ['uf', 'estado'] },
  { key: 'site', label: 'Site', candidates: ['site', 'website', 'url'] },
  { key: 'banco', label: 'Banco', candidates: ['banco'] },
  { key: 'agencia', label: 'Agencia', candidates: ['agencia', 'ag'] },
  { key: 'conta', label: 'Conta', candidates: ['conta', 'cc'] },
  { key: 'chave_pix', label: 'Chave PIX', candidates: ['pix', 'chave pix', 'chavepix'] },
  { key: 'prazo_pagamento_dias', label: 'Prazo Pagamento (dias)', candidates: ['prazo pagamento', 'prazo', 'pagamento'] },
  { key: 'valor_minimo_pedido', label: 'Valor Minimo Pedido', candidates: ['valor minimo', 'minimo', 'pedido minimo'] },
  { key: 'observacao', label: 'Observacao', candidates: ['observacao', 'obs', 'comentario'] },
]

type Step = 'upload' | 'map' | 'preview' | 'done'

interface ValidationRow {
  data: Record<string, unknown>
  errors: string[]
  warnings: string[]
}

export default function FornecedorImportDialog({ open, onClose, onImported }: Props) {
  const { empresa } = useEmpresa()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validated, setValidated] = useState<ValidationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ ok: 0, fail: 0 })

  async function handleFile(file: File) {
    setLoading(true)
    try {
      const parsed = await parseSheet(file)
      if (!parsed.rows.length) {
        toast({ title: 'Arquivo vazio', variant: 'destructive' })
        return
      }
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      // auto-detect mapeamento
      const autoMap: Record<string, string> = {}
      for (const field of FIELDS) {
        const found = detectColumn(parsed.headers, field.candidates)
        if (found) autoMap[field.key] = found
      }
      setMapping(autoMap)
      setStep('map')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler planilha'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  function runValidation() {
    if (!mapping.razao_social) {
      toast({ title: 'Mapeie a Razao Social (obrigatorio)', variant: 'destructive' })
      return
    }

    const result: ValidationRow[] = rows.map((row) => {
      const errors: string[] = []
      const warnings: string[] = []
      const mapped: Record<string, unknown> = {}

      for (const field of FIELDS) {
        const header = mapping[field.key]
        if (!header) continue
        mapped[field.key] = row[header]
      }

      const razao = String(mapped.razao_social ?? '').trim()
      if (!razao) errors.push('Razao social vazia')

      if (mapped.cnpj) {
        const cnpj = normalizeCnpj(mapped.cnpj)
        if (!cnpj) warnings.push('CNPJ invalido — sera salvo como nulo')
        mapped.cnpj = cnpj || null
      }

      if (mapped.cep) {
        const cep = normalizeCep(mapped.cep)
        if (!cep) warnings.push('CEP invalido')
        mapped.cep = cep || null
      }

      if (mapped.valor_minimo_pedido !== undefined) {
        mapped.valor_minimo_pedido = normalizeMoney(mapped.valor_minimo_pedido) || null
      }
      if (mapped.prazo_pagamento_dias !== undefined) {
        mapped.prazo_pagamento_dias = toIntOrNull(mapped.prazo_pagamento_dias)
      }

      // uf uppercase
      if (mapped.uf) mapped.uf = String(mapped.uf).trim().toUpperCase().slice(0, 2)

      // strings
      for (const k of ['razao_social', 'nome_fantasia', 'inscricao_estadual', 'email', 'telefone', 'celular',
        'contato_nome', 'logradouro', 'numero', 'bairro', 'cidade', 'site', 'banco', 'agencia', 'conta', 'chave_pix', 'observacao']) {
        if (mapped[k] !== undefined) mapped[k] = toStringOrNull(mapped[k])
      }

      return { data: mapped, errors, warnings }
    })

    setValidated(result)
    setStep('preview')
  }

  async function doImport() {
    if (!empresa) return
    const valid = validated.filter((r) => r.errors.length === 0)
    if (!valid.length) {
      toast({ title: 'Nenhuma linha valida para importar', variant: 'destructive' })
      return
    }

    setLoading(true)
    setProgress({ ok: 0, fail: 0 })

    // Batch de 50 em 50
    const payload = valid.map((r) => ({ empresa_id: empresa.id, ...r.data }))
    const batchSize = 50
    let ok = 0
    let fail = 0

    for (let i = 0; i < payload.length; i += batchSize) {
      const batch = payload.slice(i, i + batchSize)
      const { error } = await supabase.from('fornecedores').insert(batch)
      if (error) {
        fail += batch.length
      } else {
        ok += batch.length
      }
      setProgress({ ok, fail })
    }

    setLoading(false)
    setStep('done')
    toast({
      title: `Importacao concluida`,
      description: `${ok} criados, ${fail} falhas`,
      variant: fail > 0 ? 'destructive' : 'success',
    })
    if (ok > 0) setTimeout(() => onImported(), 1500)
  }

  function reset() {
    setStep('upload')
    setHeaders([])
    setRows([])
    setMapping({})
    setValidated([])
    setProgress({ ok: 0, fail: 0 })
  }

  const errorCount = validated.filter((r) => r.errors.length > 0).length
  const warnCount = validated.filter((r) => r.warnings.length > 0 && r.errors.length === 0).length
  const okCount = validated.length - errorCount

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClose={onClose} className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            Importar Fornecedores
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'upload' && (
            <div>
              <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[var(--theme-subtle-border)] bg-[var(--theme-subtle-bg)] cursor-pointer hover:border-amber-500/40 transition-colors">
                <div className="p-3 rounded-xl bg-amber-500/15">
                  <Upload className="h-6 w-6 text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Clique para selecionar arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">XLSX, XLS ou CSV</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </label>
              {loading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lendo planilha...
                </div>
              )}
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300">
                  Associe cada campo do sistema a uma coluna da planilha. O sistema ja sugeriu os mapeamentos.
                  <span className="block mt-1 text-blue-400/80">{rows.length} linhas detectadas</span>
                </p>
              </div>
              <div className="grid gap-2">
                {FIELDS.map((field) => (
                  <div key={field.key} className="grid grid-cols-[160px_1fr] gap-2 items-center">
                    <Label className="text-xs flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-red-400">*</span>}
                    </Label>
                    <Select
                      value={mapping[field.key] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    >
                      <option value="">-- ignorar --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-300">{okCount}</p>
                  <p className="text-[11px] text-emerald-400/80">Validos</p>
                </div>
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-300">{warnCount}</p>
                  <p className="text-[11px] text-amber-400/80">Com avisos</p>
                </div>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-red-300">{errorCount}</p>
                  <p className="text-[11px] text-red-400/80">Com erros</p>
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {validated.slice(0, 100).map((row, idx) => {
                  const hasErr = row.errors.length > 0
                  const hasWarn = row.warnings.length > 0
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs ${
                        hasErr
                          ? 'bg-red-500/5 border-red-500/20'
                          : hasWarn
                          ? 'bg-amber-500/5 border-amber-500/20'
                          : 'bg-emerald-500/5 border-emerald-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {hasErr ? (
                          <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="font-semibold text-foreground truncate">
                          {String(row.data.razao_social ?? '(sem razao social)')}
                        </span>
                        {row.data.cnpj != null && (
                          <span className="text-[10px] font-mono text-muted-foreground">{String(row.data.cnpj)}</span>
                        )}
                      </div>
                      {(hasErr || hasWarn) && (
                        <div className="mt-1 ml-5 space-y-0.5">
                          {row.errors.map((e, i) => (
                            <p key={`e${i}`} className="text-red-400">• {e}</p>
                          ))}
                          {row.warnings.map((w, i) => (
                            <p key={`w${i}`} className="text-amber-400">• {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {validated.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ... e mais {validated.length - 100} linhas
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <Check className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-foreground">Importacao concluida</p>
              <p className="text-sm text-muted-foreground">{progress.ok} fornecedores criados{progress.fail > 0 ? `, ${progress.fail} falharam` : ''}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          )}
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={runValidation}>Validar e pre-visualizar</Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>Voltar</Button>
              <Button onClick={doImport} disabled={loading || okCount === 0}>
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Importando...</span>
                ) : (
                  `Importar ${okCount} valido${okCount !== 1 ? 's' : ''}`
                )}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
