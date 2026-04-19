import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { PERMISSION_GROUPS } from '@/lib/permissions'
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2, ShieldCheck, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Hierarquia } from '@/types/database'

export default function Hierarquias() {
  const { empresa } = useEmpresa()
  const { isMaster, isAdmin } = usePermissions()
  const { toast } = useToast()
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Hierarquia | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tab, setTab] = useState<'hierarquias' | 'permissoes'>('hierarquias')

  // Permissoes state: { hierarquiaId -> Set<permissao> }
  const [permMap, setPermMap] = useState<Record<string, Set<string>>>({})
  const [permLoading, setPermLoading] = useState(false)

  useEffect(() => {
    if (empresa) fetchHierarquias()
  }, [empresa])

  async function fetchHierarquias() {
    const { data } = await supabase
      .from('hierarquias')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .order('ordem', { ascending: true })

    setHierarquias(data ?? [])
    setLoading(false)
  }

  const fetchPermissoes = useCallback(async () => {
    if (!empresa || hierarquias.length === 0) return
    setPermLoading(true)

    const hierIds = hierarquias.map(h => h.id)
    const { data } = await supabase
      .from('hierarquia_permissoes')
      .select('hierarquia_id, permissao')
      .in('hierarquia_id', hierIds)

    const map: Record<string, Set<string>> = {}
    for (const h of hierarquias) map[h.id] = new Set()
    for (const row of data ?? []) {
      if (map[row.hierarquia_id]) map[row.hierarquia_id].add(row.permissao)
    }

    setPermMap(map)
    setPermLoading(false)
  }, [empresa, hierarquias])

  useEffect(() => {
    if (tab === 'permissoes') fetchPermissoes()
  }, [tab, fetchPermissoes])

  function openCreate() {
    setEditing(null)
    setNome('')
    setDescricao('')
    setDialogOpen(true)
  }

  function openEdit(h: Hierarquia) {
    setEditing(h)
    setNome(h.nome)
    setDescricao(h.descricao ?? '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!empresa) return

    if (editing) {
      const { error } = await supabase
        .from('hierarquias')
        .update({ nome, descricao: descricao || null })
        .eq('id', editing.id)

      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Hierarquia atualizada', variant: 'success' })
    } else {
      const maxOrdem = hierarquias.length > 0 ? Math.max(...hierarquias.map((h) => h.ordem)) : 0
      const { error } = await supabase
        .from('hierarquias')
        .insert({ empresa_id: empresa.id, nome, descricao: descricao || null, ordem: maxOrdem + 1 })

      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Hierarquia criada', variant: 'success' })
    }

    setDialogOpen(false)
    fetchHierarquias()
  }

  async function handleDelete(h: Hierarquia) {
    if (!confirm(`Excluir hierarquia "${h.nome}"?`)) return

    const { error } = await supabase.from('hierarquias').delete().eq('id', h.id)

    if (error) {
      toast({
        title: 'Não é possível excluir',
        description: error.message.includes('violates foreign key')
          ? 'Existem usuários vinculados a esta hierarquia.'
          : error.message,
        variant: 'destructive',
      })
      return
    }

    toast({ title: 'Hierarquia excluída', variant: 'success' })
    fetchHierarquias()
  }

  async function handleMove(h: Hierarquia, direction: 'up' | 'down') {
    const idx = hierarquias.findIndex((x) => x.id === h.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= hierarquias.length) return

    const other = hierarquias[swapIdx]
    const myOrdem = h.ordem
    const otherOrdem = other.ordem

    const tempOrdem = Math.max(...hierarquias.map(x => x.ordem)) + 1

    const { error: e1 } = await supabase.from('hierarquias').update({ ordem: tempOrdem }).eq('id', h.id)
    if (e1) { toast({ title: 'Erro ao mover', description: e1.message, variant: 'destructive' }); return }

    const { error: e2 } = await supabase.from('hierarquias').update({ ordem: myOrdem }).eq('id', other.id)
    if (e2) { toast({ title: 'Erro ao mover', description: e2.message, variant: 'destructive' }); return }

    const { error: e3 } = await supabase.from('hierarquias').update({ ordem: otherOrdem }).eq('id', h.id)
    if (e3) { toast({ title: 'Erro ao mover', description: e3.message, variant: 'destructive' }); return }

    fetchHierarquias()
  }

  async function togglePermissao(hierarquiaId: string, permissao: string) {
    const current = permMap[hierarquiaId] ?? new Set()
    const hasIt = current.has(permissao)

    // Optimistic update
    setPermMap(prev => {
      const next = { ...prev }
      const set = new Set(prev[hierarquiaId] ?? [])
      if (hasIt) set.delete(permissao)
      else set.add(permissao)
      next[hierarquiaId] = set
      return next
    })

    if (hasIt) {
      const { error } = await supabase
        .from('hierarquia_permissoes')
        .delete()
        .eq('hierarquia_id', hierarquiaId)
        .eq('permissao', permissao)

      if (error) {
        toast({ title: 'Erro ao remover permissão', description: error.message, variant: 'destructive' })
        // Rollback
        setPermMap(prev => {
          const next = { ...prev }
          const set = new Set(prev[hierarquiaId] ?? [])
          set.add(permissao)
          next[hierarquiaId] = set
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('hierarquia_permissoes')
        .insert({ hierarquia_id: hierarquiaId, permissao })

      if (error) {
        toast({ title: 'Erro ao adicionar permissão', description: error.message, variant: 'destructive' })
        // Rollback
        setPermMap(prev => {
          const next = { ...prev }
          const set = new Set(prev[hierarquiaId] ?? [])
          set.delete(permissao)
          next[hierarquiaId] = set
          return next
        })
      }
    }
  }

  async function toggleGroupForHierarquia(hierarquiaId: string, permKeys: string[]) {
    const current = permMap[hierarquiaId] ?? new Set()
    const allOn = permKeys.every(k => current.has(k))
    const target = !allOn // se nem todos estão on, liga todos; senão desliga todos

    // Optimistic
    setPermMap(prev => {
      const next = { ...prev }
      const set = new Set(prev[hierarquiaId] ?? [])
      for (const k of permKeys) {
        if (target) set.add(k)
        else set.delete(k)
      }
      next[hierarquiaId] = set
      return next
    })

    if (target) {
      // Insert missing
      const toInsert = permKeys.filter(k => !current.has(k)).map(k => ({ hierarquia_id: hierarquiaId, permissao: k }))
      if (toInsert.length > 0) {
        const { error } = await supabase.from('hierarquia_permissoes').upsert(toInsert, { onConflict: 'hierarquia_id,permissao' })
        if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); fetchPermissoes() }
      }
    } else {
      // Delete all
      const { error } = await supabase
        .from('hierarquia_permissoes')
        .delete()
        .eq('hierarquia_id', hierarquiaId)
        .in('permissao', permKeys)
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); fetchPermissoes() }
    }
  }

  // Hierarquias configuráveis (exclui admin)
  const editableHierarquias = hierarquias.filter(h => !h.nome.toLowerCase().includes('admin'))

  if (!(isMaster || isAdmin)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
          <ShieldCheck className="h-8 w-8 text-zinc-600" />
        </div>
        <p className="text-zinc-400 font-medium">Acesso restrito</p>
        <p className="text-zinc-600 text-sm mt-1">Apenas administradores podem gerenciar hierarquias.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Hierarquias</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Estrutura organizacional e níveis de acesso</p>
          </div>
        </div>
        {tab === 'hierarquias' && (
          <Button onClick={openCreate} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Hierarquia</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-900/60 border border-white/[0.06] w-fit">
        <button
          onClick={() => setTab('hierarquias')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            tab === 'hierarquias'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
          )}
        >
          Hierarquias
        </button>
        <button
          onClick={() => setTab('permissoes')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            tab === 'permissoes'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
          )}
        >
          Permissões
        </button>
      </div>

      {tab === 'hierarquias' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 stagger-children">
            <Card className="border-indigo-500/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10">
                  <Layers className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-indigo-300">{hierarquias.length}</p>
                  <p className="text-[11px] text-zinc-500 font-medium">Níveis Cadastrados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{hierarquias.filter(h => h.ativo).length}</p>
                  <p className="text-[11px] text-zinc-500 font-medium">Níveis Ativos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="py-8 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Ordem</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-40">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hierarquias.map((h, idx) => (
                          <TableRow key={h.id}>
                            <TableCell>
                              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-300">
                                {h.ordem}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{h.nome}</TableCell>
                            <TableCell className="text-zinc-500">{h.descricao ?? <span className="text-zinc-600">—</span>}</TableCell>
                            <TableCell>
                              <Badge variant={h.ativo ? 'success' : 'secondary'}>
                                {h.ativo ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleMove(h, 'up')} disabled={idx === 0} title="Subir">
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleMove(h, 'down')} disabled={idx === hierarquias.length - 1} title="Descer">
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(h)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(h)} title="Excluir">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {hierarquias.map((h, idx) => (
                      <div key={h.id} className="rounded-xl border border-white/[0.06] p-3.5">
                        <div className="flex items-center gap-3 mb-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                            {h.ordem}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white text-sm truncate">{h.nome}</p>
                            {h.descricao && <p className="text-xs text-zinc-500 truncate">{h.descricao}</p>}
                          </div>
                          <Badge variant={h.ativo ? 'success' : 'secondary'}>{h.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => handleMove(h, 'up')} disabled={idx === 0} className="h-10 w-10" title="Subir">
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleMove(h, 'down')} disabled={idx === hierarquias.length - 1} className="h-10 w-10" title="Descer">
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(h)} className="h-10 w-10" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(h)} className="h-10 w-10" title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'permissoes' && (
        <PermissoesGrid
          hierarquias={editableHierarquias}
          permMap={permMap}
          loading={permLoading}
          onToggle={togglePermissao}
          onToggleGroup={toggleGroupForHierarquia}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Hierarquia' : 'Nova Hierarquia'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Gerente" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do nível" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Grid de Permissões ────────────────────────────────────────

interface PermissoesGridProps {
  hierarquias: Hierarquia[]
  permMap: Record<string, Set<string>>
  loading: boolean
  onToggle: (hierarquiaId: string, permissao: string) => void
  onToggleGroup: (hierarquiaId: string, permKeys: string[]) => void
}

function PermissoesGrid({ hierarquias, permMap, loading, onToggle, onToggleGroup }: PermissoesGridProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(Object.keys(PERMISSION_GROUPS)))
  // Mobile: selected hierarchy
  const [selectedHier, setSelectedHier] = useState<string | null>(null)

  useEffect(() => {
    if (hierarquias.length > 0 && !selectedHier) {
      setSelectedHier(hierarquias[0].id)
    }
  }, [hierarquias, selectedHier])

  function toggleGroup(group: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  if (hierarquias.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-zinc-400">Nenhuma hierarquia configurável encontrada.</p>
          <p className="text-xs text-zinc-600 mt-1">Crie hierarquias na aba anterior (Admin é sempre completo).</p>
        </CardContent>
      </Card>
    )
  }

  const groups = Object.entries(PERMISSION_GROUPS)

  // ─── Desktop: tabela hierarquias como colunas ───
  const desktopGrid = (
    <div className="hidden lg:block">
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-3 text-zinc-400 font-medium min-w-[220px]">Permissão</th>
                {hierarquias.map(h => (
                  <th key={h.id} className="text-center py-3 px-2 text-zinc-300 font-semibold min-w-[100px]">
                    {h.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([groupKey, group]) => {
                const permKeys = Object.keys(group.permissions)
                const isExpanded = expandedGroups.has(groupKey)

                return (
                  <GroupRows
                    key={groupKey}
                    groupKey={groupKey}
                    groupLabel={group.label}
                    permissions={group.permissions}
                    permKeys={permKeys}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleGroup(groupKey)}
                    hierarquias={hierarquias}
                    permMap={permMap}
                    onToggle={onToggle}
                    onToggleGroup={onToggleGroup}
                  />
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )

  // ─── Mobile: cards por hierarquia ───
  const mobileGrid = (
    <div className="lg:hidden space-y-3">
      {/* Hierarchy selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {hierarquias.map(h => (
          <button
            key={h.id}
            onClick={() => setSelectedHier(h.id)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer shrink-0',
              selectedHier === h.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-zinc-900/60 text-zinc-400 border border-white/[0.06]'
            )}
          >
            {h.nome}
          </button>
        ))}
      </div>

      {selectedHier && (
        <div className="space-y-2">
          {groups.map(([groupKey, group]) => {
            const permEntries = Object.entries(group.permissions)
            const permKeys = permEntries.map(([k]) => k)
            const allOn = permKeys.every(k => permMap[selectedHier]?.has(k))
            const someOn = permKeys.some(k => permMap[selectedHier]?.has(k))
            const isExpanded = expandedGroups.has(groupKey)

            return (
              <Card key={groupKey} className="border-white/[0.06]">
                <CardContent className="p-0">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between p-3.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                      )}
                      <span className="font-semibold text-sm text-zinc-200">{group.label}</span>
                      <Badge variant={allOn ? 'success' : someOn ? 'default' : 'secondary'} className="text-[10px]">
                        {permKeys.filter(k => permMap[selectedHier]?.has(k)).length}/{permKeys.length}
                      </Badge>
                    </div>
                    <Switch
                      checked={allOn}
                      onCheckedChange={() => onToggleGroup(selectedHier, permKeys)}
                    />
                  </button>

                  {/* Permission items */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] px-3.5 pb-3 space-y-1">
                      {permEntries.map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between py-2 min-h-[44px]">
                          <span className="text-xs text-zinc-400 pr-3">{label}</span>
                          <Switch
                            checked={permMap[selectedHier]?.has(key) ?? false}
                            onCheckedChange={() => onToggle(selectedHier, key)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <>
      {desktopGrid}
      {mobileGrid}
    </>
  )
}

// ─── Desktop group rows ────────────────────────────────────────

interface GroupRowsProps {
  groupKey: string
  groupLabel: string
  permissions: Record<string, string>
  permKeys: string[]
  isExpanded: boolean
  onToggleExpand: () => void
  hierarquias: Hierarquia[]
  permMap: Record<string, Set<string>>
  onToggle: (hierarquiaId: string, permissao: string) => void
  onToggleGroup: (hierarquiaId: string, permKeys: string[]) => void
}

function GroupRows({ groupLabel, permissions, permKeys, isExpanded, onToggleExpand, hierarquias, permMap, onToggle, onToggleGroup }: GroupRowsProps) {
  return (
    <>
      {/* Group header row */}
      <tr className="border-b border-white/[0.04] bg-white/[0.02]">
        <td className="py-2.5 px-3">
          <button onClick={onToggleExpand} className="flex items-center gap-2 cursor-pointer">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
            <span className="font-semibold text-zinc-200 text-sm">{groupLabel}</span>
          </button>
        </td>
        {hierarquias.map(h => {
          const allOn = permKeys.every(k => permMap[h.id]?.has(k))
          return (
            <td key={h.id} className="text-center py-2.5 px-2">
              <div className="flex justify-center">
                <Switch
                  checked={allOn}
                  onCheckedChange={() => onToggleGroup(h.id, permKeys)}
                />
              </div>
            </td>
          )
        })}
      </tr>

      {/* Individual permission rows */}
      {isExpanded && Object.entries(permissions).map(([key, label]) => (
        <tr key={key} className="border-b border-white/[0.03]">
          <td className="py-2 px-3 pl-9 text-xs text-zinc-400">{label}</td>
          {hierarquias.map(h => (
            <td key={h.id} className="text-center py-2 px-2">
              <div className="flex justify-center">
                <Switch
                  checked={permMap[h.id]?.has(key) ?? false}
                  onCheckedChange={() => onToggle(h.id, key)}
                />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
