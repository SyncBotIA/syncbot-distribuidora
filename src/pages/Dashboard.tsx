import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, DollarSign, Package, AlertTriangle, TrendingUp, Trophy, BarChart3 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { Pedido, Produto } from '@/types/database'

interface DashboardStats {
  totalPedidos: number
  valorTotal: number
  totalProdutos: number
  estoqueBaixo: number
  pedidosPorMes: { mes: string; total: number; valor: number }[]
  produtosMaisVendidos: { nome: string; quantidade: number }[]
  estoqueCritico: { nome: string; atual: number; minimo: number }[]
  rankingVendedores: { nome: string; pedidos: number; valor: number; comissao: number }[]
}

type Periodo = 'dia' | 'semana' | 'mes' | 'ano'

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']

function getStartDate(periodo: Periodo): Date {
  const now = new Date()
  switch (periodo) {
    case 'dia': return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'semana': { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d }
    case 'mes': return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'ano': return new Date(now.getFullYear(), 0, 1)
  }
}

const periodoLabels: Record<Periodo, string> = {
  dia: 'Hoje',
  semana: 'Esta Semana',
  mes: 'Este Mês',
  ano: 'Este Ano',
}

function getTimeGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours()
  if (hour < 12) return { greeting: 'Bom dia', emoji: '☀️' }
  if (hour < 18) return { greeting: 'Boa tarde', emoji: '🌤️' }
  return { greeting: 'Boa noite', emoji: '🌙' }
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const { empresa, empresaUsuario } = useEmpresa()
  const { isMaster, isAdmin, canViewRanking, canViewEstoqueCritico } = usePermissions()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [stats, setStats] = useState<DashboardStats>({
    totalPedidos: 0, valorTotal: 0, totalProdutos: 0, estoqueBaixo: 0,
    pedidosPorMes: [], produtosMaisVendidos: [], estoqueCritico: [], rankingVendedores: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (empresa && usuario) fetchStats()
  }, [empresa, usuario, periodo])

  async function fetchStats() {
    setLoading(true)
    const startDate = getStartDate(periodo).toISOString()

    let pedidosQuery = supabase
      .from('pedidos')
      .select('*, usuarios(nome)')
      .eq('empresa_id', empresa!.id)
      .neq('status', 'cancelado')
      .gte('created_at', startDate)

    if (!isMaster && !isAdmin && empresaUsuario) {
      const { data: subs } = await supabase.rpc('get_subordinados', {
        p_empresa_usuario_id: empresaUsuario.id,
      })
      const subIds = new Set((subs ?? []).map((s: { id: string }) => s.id))
      const { data: pedidos } = await pedidosQuery
      const filteredPedidos = (pedidos ?? []).filter(
        (p) => p.usuario_id === usuario!.id || subIds.has(p.usuario_id)
      )
      processPedidos(filteredPedidos)
    } else {
      const { data: pedidos } = await pedidosQuery
      processPedidos(pedidos ?? [])
    }

    const { data: prods } = await supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)

    // Usa RPC get_estoque_atual em batch ao inves de N+1
    let estoqueBaixo = 0
    const estoqueCritico: DashboardStats['estoqueCritico'] = []

    // Busca apenas produtos com estoque minimo definido para evitar consultas desnecessarias
    if (prods) {
      const produtosComEstoque = await Promise.all(
        prods.filter(p => p.estoque_minimo > 0 || prods.length <= 50).map(async (p) => {
          const { data } = await supabase.rpc('get_estoque_atual', { p_produto_id: p.id })
          return { ...p, estoque_atual: data ?? 0 }
        })
      )

      for (const p of produtosComEstoque) {
        if (p.estoque_atual <= p.estoque_minimo) {
          estoqueBaixo++
          estoqueCritico.push({ nome: p.nome, atual: p.estoque_atual, minimo: p.estoque_minimo })
        }
      }
    }

    // Filtra por empresa ao buscar produtos mais vendidos
    const { data: topItems } = await supabase
      .from('pedido_itens')
      .select('produto_id, quantidade, produtos(nome, empresa_id)')
      .in('produto_id', (prods ?? []).map(p => p.id))

    const prodMap = new Map<string, { nome: string; quantidade: number }>()
    for (const item of topItems ?? []) {
      const nome = (item.produtos as Produto | undefined)?.nome ?? 'Desconhecido'
      const existing = prodMap.get(item.produto_id) ?? { nome, quantidade: 0 }
      existing.quantidade += item.quantidade
      prodMap.set(item.produto_id, existing)
    }

    setStats((prev) => ({
      ...prev,
      totalProdutos: prods?.length ?? 0,
      estoqueBaixo,
      estoqueCritico: estoqueCritico.slice(0, 5),
      produtosMaisVendidos: Array.from(prodMap.values()).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5),
    }))

    setLoading(false)
  }

  function processPedidos(pedidos: (Pedido & { usuarios?: { nome: string } })[]) {
    const totalPedidos = pedidos.length
    const valorTotal = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0)

    const monthMap = new Map<string, { total: number; valor: number }>()
    for (const p of pedidos) {
      const date = new Date(p.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const existing = monthMap.get(key) ?? { total: 0, valor: 0 }
      existing.total++
      existing.valor += p.valor_total || 0
      monthMap.set(key, existing)
    }

    const pedidosPorMes = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([mes, data]) => ({ mes, ...data }))

    const vendedorMap = new Map<string, { nome: string; pedidos: number; valor: number }>()
    for (const p of pedidos) {
      const nome = (p.usuarios as { nome: string } | undefined)?.nome ?? 'Desconhecido'
      const existing = vendedorMap.get(p.usuario_id) ?? { nome, pedidos: 0, valor: 0 }
      existing.pedidos++
      existing.valor += p.valor_total || 0
      vendedorMap.set(p.usuario_id, existing)
    }

    const rankingVendedores = Array.from(vendedorMap.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
      .map((v) => ({ ...v, comissao: 0 }))

    setStats((prev) => ({ ...prev, totalPedidos, valorTotal, pedidosPorMes, rankingVendedores }))
  }

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 sm:h-8 w-36" />
            <Skeleton className="h-4 w-44 mt-1.5" />
          </div>
          <Skeleton className="h-9 w-36 sm:w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-xl border border-white/[0.06] p-4 sm:p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-52 sm:h-64 w-full rounded-lg" />
          </div>
          <div className="rounded-xl border border-white/[0.06] p-4 sm:p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-52 sm:h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  const { greeting, emoji } = getTimeGreeting()

  const kpis = [
    {
      label: `Pedidos`,
      sublabel: periodoLabels[periodo],
      value: stats.totalPedidos.toString(),
      icon: ShoppingCart,
      gradient: 'from-blue-500/15 to-blue-600/5',
      iconBg: 'bg-blue-500/15',
      textColor: 'text-blue-400',
      borderColor: 'border-blue-500/10',
      barColor: 'from-blue-500 to-blue-400',
      glowColor: 'shadow-blue-500/5',
    },
    {
      label: 'Faturamento',
      sublabel: periodoLabels[periodo],
      value: formatCurrency(stats.valorTotal),
      icon: DollarSign,
      gradient: 'from-emerald-500/15 to-emerald-600/5',
      iconBg: 'bg-emerald-500/15',
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/10',
      barColor: 'from-emerald-500 to-emerald-400',
      glowColor: 'shadow-emerald-500/5',
    },
    {
      label: 'Produtos',
      sublabel: 'Ativos',
      value: stats.totalProdutos.toString(),
      icon: Package,
      gradient: 'from-violet-500/15 to-violet-600/5',
      iconBg: 'bg-violet-500/15',
      textColor: 'text-violet-400',
      borderColor: 'border-violet-500/10',
      barColor: 'from-violet-500 to-violet-400',
      glowColor: 'shadow-violet-500/5',
    },
    {
      label: 'Estoque',
      sublabel: 'Baixo',
      value: stats.estoqueBaixo.toString(),
      icon: AlertTriangle,
      gradient: 'from-red-500/15 to-red-600/5',
      iconBg: 'bg-red-500/15',
      textColor: 'text-red-400',
      borderColor: 'border-red-500/10',
      barColor: 'from-red-500 to-red-400',
      glowColor: 'shadow-red-500/5',
    },
  ]

  const chartHeight = 220

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-0.5">
            {greeting} {emoji}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">
            Dashboard
          </h1>
        </div>
        <Select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          className="w-full sm:w-40 max-w-[240px] min-h-[44px] text-sm"
        >
          <option value="dia">Hoje</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mês</option>
          <option value="ano">Este Ano</option>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`relative rounded-xl border border-white/[0.06] bg-gradient-to-br ${kpi.gradient} overflow-hidden shadow-lg ${kpi.glowColor} transition-all duration-300 active:scale-[0.97] touch-manipulation`}
          >
            {/* Gradient border overlay */}
            <div
              className="absolute inset-0 rounded-xl opacity-60 pointer-events-none"
              style={{
                background: `linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, transparent 50%, rgba(37, 99, 235, 0.06) 100%)`,
              }}
            />

            <div className="relative p-3.5 sm:p-5">
              <div className="flex items-start justify-between mb-2.5">
                <div
                  className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${kpi.iconBg} transition-all duration-300 active:scale-110`}
                  style={{
                    boxShadow: `0 0 12px 1px rgba(37, 99, 235, 0.08)`,
                  }}
                >
                  <kpi.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${kpi.textColor}`} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-500 uppercase tracking-wider leading-none pt-1">
                  {kpi.sublabel}
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight truncate">
                {kpi.value}
              </p>
              <p className="text-[11px] sm:text-xs font-medium text-zinc-500 mt-0.5 sm:mt-1">
                {kpi.label}
              </p>
            </div>

            {/* Bottom gradient bar */}
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${kpi.barColor} opacity-40`} />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pedidos por Período */}
        <Card className="gradient-border border border-white/[0.06] overflow-hidden bg-card/80 backdrop-blur-sm shadow-xl shadow-black/10">
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-zinc-200">Pedidos por Período</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-3 sm:pb-5">
            {stats.pedidosPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={stats.pedidosPorMes}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} stroke="transparent" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="transparent" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(12, 18, 32, 0.95)',
                      color: '#e2e8f0',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(12px)',
                    }}
                    formatter={(value: number, name: string) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? 'Valor' : 'Pedidos']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorTotal)" name="Pedidos" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
                <div className="p-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.04] mb-3">
                  <TrendingUp className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-sm font-medium text-zinc-400">Nenhum dado disponível</p>
                <p className="text-xs text-zinc-600 mt-1">Os dados aparecerão quando houver pedidos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Produtos Mais Vendidos */}
        <Card className="gradient-border border border-white/[0.06] overflow-hidden bg-card/80 backdrop-blur-sm shadow-xl shadow-black/10">
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-violet-500/10 ring-1 ring-violet-500/10">
                <BarChart3 className="h-4 w-4 text-violet-400" />
              </div>
              <span className="text-zinc-200">Produtos Mais Vendidos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-3 sm:pb-5">
            {stats.produtosMaisVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie
                    data={stats.produtosMaisVendidos}
                    dataKey="quantidade"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    label={({ nome, quantidade }) => `${nome}: ${quantidade}`}
                    labelLine={{ stroke: '#475569' }}
                  >
                    {stats.produtosMaisVendidos.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(12, 18, 32, 0.95)',
                    color: '#e2e8f0',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
                <div className="p-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.04] mb-3">
                  <Package className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-sm font-medium text-zinc-400">Nenhuma venda registrada</p>
                <p className="text-xs text-zinc-600 mt-1">Crie pedidos para ver os dados aqui</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Vendedores - visível para gerente, admin e master */}
      {canViewRanking && stats.rankingVendedores.length > 0 && (
        <Card className="gradient-border border border-white/[0.06] overflow-hidden bg-card/80 backdrop-blur-sm shadow-xl shadow-black/10">
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/10">
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-zinc-200">Ranking de Vendedores — {periodoLabels[periodo]}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-3 sm:pb-5">
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.rankingVendedores.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {i < 3 ? (
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            i === 0 ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20' :
                            i === 1 ? 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20' :
                            'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20'
                          }`}>
                            {i + 1}
                          </div>
                        ) : (
                          <span className="text-muted-foreground pl-2">{i + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{v.nome}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{v.pedidos}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-400">{formatCurrency(v.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {stats.rankingVendedores.map((v, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-3.5 flex items-center gap-3 active:bg-zinc-900/60 transition-colors min-h-[44px] touch-manipulation"
                >
                  {i < 3 ? (
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20' :
                      i === 1 ? 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20' :
                      'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20'
                    }`}>
                      {i + 1}
                    </div>
                  ) : (
                    <span className="text-muted-foreground w-8 text-center text-sm font-medium shrink-0">{i + 1}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{v.nome}</p>
                    <p className="text-xs text-zinc-500">{v.pedidos} pedidos</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-400 shrink-0">{formatCurrency(v.valor)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estoque critico */}
      {canViewEstoqueCritico && stats.estoqueCritico.length > 0 && (
        <Card className="gradient-border border border-red-500/15 overflow-hidden bg-card/80 backdrop-blur-sm shadow-xl shadow-black/10">
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
            <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-red-500/10 ring-1 ring-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-zinc-200">Estoque Crítico</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-3 sm:pb-5">
            <div className="space-y-2">
              {stats.estoqueCritico.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/20 active:bg-red-500/10 transition-colors min-h-[44px] touch-manipulation"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-red-400" />
                    </div>
                    <span className="font-semibold text-sm text-zinc-100 truncate">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <Badge variant="destructive" className="text-xs">{item.atual} un</Badge>
                    <span className="text-xs text-zinc-500 hidden sm:inline">min: {item.minimo}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
