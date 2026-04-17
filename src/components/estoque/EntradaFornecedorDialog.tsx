import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Factory, FileText, Plus, Trash2, Upload, Calendar, Package,
  Loader2, AlertCircle, Check, X, FileSpreadsheet,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  parseSheet, detectColumn, normalizeMoney, toStringOrNull,
} from '@/lib/xlsx-parser'
import type { Fornecedor, ProdutoFornecedor, Produto } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface Linha {
  uid: string
  produto_id: string
  produto_fornecedor_id: string | null
  quantidade: string
  preco_custo_unitario: string
}

type PFRow = ProdutoFornecedor & { produto?: Produto }

const uid = () => Math.random().toString(36).slice(2, 11)

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

export default function EntradaFornecedorDialog({ open, onClose, onSaved }: Props) {
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { has } = usePermissions()
  const { toast } = useToast()

  const [step, setStep] = useState<'form' | 'import-map' | 'import-preview' | 'done'>('form')
  const [saving, setSaving] = useState(false)
  const [loadingProdutos, setLoadingProdutos] = useState(false)

  const [fornecedorId, setFornecedorId] = useState('')
  const [numeroNF, setNumeroNF] = useState('')
  const [dataEntrada, setDataEntrada] = useState(hoje())
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([{ uid: uid(), produto_id: '', produto_fornecedor_id: null, quantidade: '', preco_custo_unitario: '' }])

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [produtosFornecedor, setProdutosFornecedor] = useState<PFRow[]>([])

  // importacao
  const [importOpen, setImportOpen] = useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<{ codigo: string; quantidade: string; preco: string }>({ codigo: '', quantidade: '', preco: '' })
  const [importPreview, setImportPreview] = useState<Array<{ row: Record<string, unknown>; match: PFRow | null; qtd: number; preco: number; error?: string }>>([])

  const canImport = has('estoque.importar_planilha')

  useEffect(() => {
    if (open && empresa) {
      reset()
      fetchFornecedores()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresa])

  useEffect(() => {
    if (fornecedorId) fetchProdutosFornecedor()
    else setProdutosFornecedor([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedorId])

  function reset() {
    setStep('form')
    setFornecedorId('')
    setNumeroNF('')
    setDataEntrada(hoje())
    setObservacao('')
    setLinhas([{ uid: uid(), produto_id: '', produto_fornecedor_id: null, quantidade: '', preco_custo_unitario: '' }])
    setImportOpen(false)
    setRows([])
    setHeaders([])
    setMapping({ codigo: '', quantidade: '', preco: '' })
    setImportPreview([])
  }

  async function fetchFornecedores() {
    const { data } = await supabase
      .from('fornecedores')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('razao_social')
    setFornecedores((data ?? []) as Fornecedor[])
  }

  async function fetchProdutosFornecedor() {
    setLoadingProdutos(true)
    const { data } = await supabase
      .from('produto_fornecedores')
      .select('*, produto:produtos(*)')
      .eq('fornecedor_id', fornecedorId)
      .eq('ativo', true)
    setProdutosFornecedor((data ?? []) as PFRow[])
    setLoadingProdutos(false)
  }

  function addLinha() {
    setLinhas((ls) => [...ls, { uid: uid(), produto_id: '', produto_fornecedor_id: null, quantidade: '', preco_custo_unitario: '' }])
  }

  function removerLinha(id: string) {
    setLinhas((ls) => ls.length === 1 ? ls : ls.filter((l) => l.uid !== id))
  }

  function atualizarLinha(id: string, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => l.uid === id ? { ...l, ...patch } : l))
  }

  function onSelectProduto(uid: string, pfId: string) {
    const pf = produtosFornecedor.find((x) => x.id === pfId)
    if (!pf) return atualizarLinha(uid, { produto_fornecedor_id: null, produto_id: '' })
    atualizarLinha(uid, {
      produto_fornecedor_id: pf.id,
      produto_id: pf.produto_id,
      preco_custo_unitario: pf.preco_custo_ultimo != null ? String(pf.preco_custo_ultimo) : '',
    })
  }

  const total = linhas.reduce((sum, l) => {
    const q = parseFloat(l.quantidade.replace(',', '.')) || 0
    const p = parseFloat(l.preco_custo_unitario.replace(',', '.')) || 0
    return sum + q * p
  }, 0)

  async function handleSave() {
    if (!empresa || !usuario) return
    if (!fornecedorId) return toast({ title: 'Selecione um fornecedor', variant: 'destructive' })

    const linhasValidas = linhas.filter((l) => l.produto_id && parseFloat(l.quantidade.replace(',', '.')) > 0)
    if (!linhasValidas.length) return toast({ title: 'Adicione ao menos um item', variant: 'destructive' })

    setSaving(true)

    // Gera lote_id via rpc ou UUID do navegador
    const loteId = crypto.randomUUID()
    const createdAt = new Date(dataEntrada + 'T12:00:00').toISOString()

    const payload = linhasValidas.map((l) => ({
      produto_id: l.produto_id,
      empresa_id: empresa.id,
      tipo: 'entrada' as const,
      quantidade: parseFloat(l.quantidade.replace(',', '.')),
      usuario_id: usuario.id,
      observacao: observacao || null,
      fornecedor_id: fornecedorId,
      numero_nota_fiscal: numeroNF || null,
      preco_custo_unitario: l.preco_custo_unitario ? parseFloat(l.preco_custo_unitario.replace(',', '.')) : null,
      lote_id: loteId,
      created_at: createdAt,
    }))

    const { error } = await supabase.from('estoque_movimentacoes').insert(payload)
    setSaving(false)
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' })

    toast({ title: 'Entrada registrada', description: `${linhasValidas.length} itens da NF ${numeroNF || '(sem numero)'}`, variant: 'success' })
    onSaved()
    onClose()
  }

  // ===== Importacao =====
  async function handleFile(file: File) {
    try {
      const parsed = await parseSheet(file)
      if (!parsed.rows.length) return toast({ title: 'Arquivo vazio', variant: 'destructive' })
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      const autoMap = {
        codigo: detectColumn(parsed.headers, ['codigo', 'sku', 'ref', 'referencia', 'cod']) ?? '',
        quantidade: detectColumn(parsed.headers, ['quantidade', 'qtd', 'qtde']) ?? '',
        preco: detectColumn(parsed.headers, ['preco', 'valor', 'custo', 'preco unitario', 'unitario']) ?? '',
      }
      setMapping(autoMap)
      setStep('import-map')
    } catch (err) {
      toast({ title: 'Erro ao ler arquivo', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    }
  }

  function validarImport() {
    if (!mapping.codigo || !mapping.quantidade) {
      return toast({ title: 'Mapeie codigo e quantidade', variant: 'destructive' })
    }
    const preview = rows.map((row) => {
      const cod = toStringOrNull(row[mapping.codigo])
      const qtd = parseFloat(String(row[mapping.quantidade]).replace(',', '.')) || 0
      const preco = mapping.preco ? normalizeMoney(row[mapping.preco]) : 0
      const match = produtosFornecedor.find((pf) => pf.codigo_no_fornecedor === cod) ?? null
      let error: string | undefined
      if (!cod) error = 'Codigo vazio'
      else if (!match) error = 'Sem vinculo com este fornecedor'
      else if (qtd <= 0) error = 'Quantidade invalida'
      return { row, match, qtd, preco, error }
    })
    setImportPreview(preview)
    setStep('import-preview')
  }

  function aplicarImport() {
    const validas = importPreview.filter((p) => !p.error && p.match)
    if (!validas.length) return toast({ title: 'Nenhuma linha valida', variant: 'destructive' })

    const novasLinhas: Linha[] = validas.map((p) => ({
      uid: uid(),
      produto_id: p.match!.produto_id,
      produto_fornecedor_id: p.match!.id,
      quantidade: String(p.qtd),
      preco_custo_unitario: p.preco > 0 ? String(p.preco) : (p.match!.preco_custo_ultimo != null ? String(p.match!.preco_custo_ultimo) : ''),
    }))

    setLinhas(novasLinhas)
    setStep('form')
    toast({ title: `${validas.length} itens importados`, variant: 'success' })
  }

  if (!open) return null

  const fornecedorSelecionado = fornecedores.find((f) => f.id === fornecedorId)
  const errorCount = importPreview.filter((p) => p.error).length
  const okCount = importPreview.length - errorCount

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClose={onClose} className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-amber-400" />
            {step === 'form' && 'Entrada de Fornecedor (Lote com NF)'}
            {step === 'import-map' && 'Importar Itens da Planilha'}
            {step === 'import-preview' && 'Preview da Importacao'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <>
            <div className="space-y-4">
              {/* Cabecalho da NF */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_160px] gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" /> Fornecedor *</Label>
                  <Select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
                    <option value="">Selecione o fornecedor...</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>{f.razao_social}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Numero da NF</Label>
                  <Input value={numeroNF} onChange={(e) => setNumeroNF(e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Data</Label>
                  <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Itens ({linhas.length})
                  </Label>
                  <div className="flex gap-2">
                    {canImport && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setImportOpen(true)}
                        disabled={!fornecedorId}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Importar planilha
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLinha}
                      disabled={!fornecedorId}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar item
                    </Button>
                  </div>
                </div>

                {!fornecedorId && (
                  <div className="rounded-xl border border-dashed border-[var(--theme-subtle-border)] p-5 text-center">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Selecione um fornecedor para adicionar itens</p>
                  </div>
                )}

                {fornecedorId && loadingProdutos && (
                  <p className="text-xs text-muted-foreground">Carregando produtos do fornecedor...</p>
                )}

                {fornecedorId && !loadingProdutos && produtosFornecedor.length === 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs text-amber-300 font-semibold">Nenhum produto vinculado</p>
                    <p className="text-[11px] text-amber-400/80 mt-1">
                      Cadastre os vinculos na tela de Produtos antes de registrar entradas deste fornecedor.
                    </p>
                  </div>
                )}

                {fornecedorId && produtosFornecedor.length > 0 && (
                  <div className="space-y-2">
                    {linhas.map((linha, idx) => {
                      const q = parseFloat(linha.quantidade.replace(',', '.')) || 0
                      const p = parseFloat(linha.preco_custo_unitario.replace(',', '.')) || 0
                      const subtotal = q * p
                      return (
                        <div
                          key={linha.uid}
                          className="rounded-xl border border-[var(--theme-subtle-border)] p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground font-mono">#{idx + 1}</span>
                            {linhas.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removerLinha(linha.uid)}
                                className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_140px] gap-2">
                            <Select
                              value={linha.produto_fornecedor_id ?? ''}
                              onChange={(e) => onSelectProduto(linha.uid, e.target.value)}
                            >
                              <option value="">Produto...</option>
                              {produtosFornecedor.map((pf) => (
                                <option key={pf.id} value={pf.id}>
                                  {pf.produto?.nome ?? '—'}
                                  {pf.codigo_no_fornecedor ? ` (${pf.codigo_no_fornecedor})` : ''}
                                </option>
                              ))}
                            </Select>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Qtd"
                              value={linha.quantidade}
                              onChange={(e) => atualizarLinha(linha.uid, { quantidade: e.target.value })}
                            />
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Preco unit."
                              value={linha.preco_custo_unitario}
                              onChange={(e) => atualizarLinha(linha.uid, { preco_custo_unitario: e.target.value })}
                            />
                          </div>
                          {subtotal > 0 && (
                            <p className="text-[11px] text-muted-foreground text-right">
                              Subtotal: <span className="text-emerald-400 font-semibold">{formatCurrency(subtotal)}</span>
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observacao</Label>
                <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Opcional" />
              </div>

              {total > 0 && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between">
                  <span className="text-sm text-emerald-300 font-semibold">Total da NF</span>
                  <span className="text-xl font-bold text-emerald-400">{formatCurrency(total)}</span>
                </div>
              )}

              {fornecedorSelecionado && (
                <div className="text-[11px] text-muted-foreground">
                  Fornecedor: <span className="text-foreground">{fornecedorSelecionado.razao_social}</span>
                  {fornecedorSelecionado.cnpj && <> · CNPJ {fornecedorSelecionado.cnpj}</>}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !fornecedorId || !linhas.some((l) => l.produto_id && parseFloat(l.quantidade.replace(',', '.')) > 0)}
              >
                {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</span> : 'Registrar Entrada'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'import-map' && (
          <>
            <div className="space-y-3">
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300">
                  O sistema ira localizar cada produto pelo <b>codigo do fornecedor</b> cadastrado nos vinculos.
                </p>
              </div>

              <div className="grid gap-2">
                <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                  <Label className="text-xs">Codigo *</Label>
                  <Select value={mapping.codigo} onChange={(e) => setMapping({ ...mapping, codigo: e.target.value })}>
                    <option value="">-- ignorar --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                  <Label className="text-xs">Quantidade *</Label>
                  <Select value={mapping.quantidade} onChange={(e) => setMapping({ ...mapping, quantidade: e.target.value })}>
                    <option value="">-- ignorar --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                  <Label className="text-xs">Preco unitario</Label>
                  <Select value={mapping.preco} onChange={(e) => setMapping({ ...mapping, preco: e.target.value })}>
                    <option value="">-- ignorar (usa ultimo) --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">{rows.length} linhas detectadas</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('form')}>Voltar</Button>
              <Button type="button" onClick={validarImport}>Validar</Button>
            </DialogFooter>
          </>
        )}

        {step === 'import-preview' && (
          <>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-300">{okCount}</p>
                  <p className="text-[11px] text-emerald-400/80">Match encontrado</p>
                </div>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-red-300">{errorCount}</p>
                  <p className="text-[11px] text-red-400/80">Com erros</p>
                </div>
              </div>

              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {importPreview.slice(0, 80).map((p, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs ${
                      p.error ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {p.error ? <X className="h-3.5 w-3.5 text-red-400" /> : <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      <span className="font-mono text-foreground">{String(p.row[mapping.codigo] ?? '—')}</span>
                      {p.match && <span className="text-muted-foreground truncate">{p.match.produto?.nome}</span>}
                      <span className="ml-auto text-muted-foreground">qtd {p.qtd}{p.preco > 0 ? ` · ${formatCurrency(p.preco)}` : ''}</span>
                    </div>
                    {p.error && <p className="ml-5 mt-1 text-red-400">{p.error}</p>}
                  </div>
                ))}
                {importPreview.length > 80 && (
                  <p className="text-xs text-muted-foreground text-center py-2">... e mais {importPreview.length - 80} linhas</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('import-map')}>Voltar</Button>
              <Button type="button" onClick={aplicarImport} disabled={okCount === 0}>
                Aplicar {okCount} itens
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Sub-dialog: upload do arquivo */}
        <Dialog open={importOpen} onOpenChange={(v) => !v && setImportOpen(false)}>
          <DialogContent onClose={() => setImportOpen(false)}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                Importar planilha
              </DialogTitle>
            </DialogHeader>
            <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-[var(--theme-subtle-border)] bg-[var(--theme-subtle-bg)] cursor-pointer hover:border-amber-500/40 transition-colors">
              <div className="p-3 rounded-xl bg-amber-500/15">
                <Upload className="h-6 w-6 text-amber-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Selecione o arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">XLSX, XLS ou CSV</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    handleFile(f)
                    setImportOpen(false)
                  }
                }}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
