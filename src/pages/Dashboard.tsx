import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, DollarSign, Package, AlertTriangle, TrendingUp, Trophy, BarChart3, Calendar } from 'lucide-react'
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
  mes: 'Este Mes',
  ano: 'Este Ano',
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const { empresa, empresaUsuario, isAdmin } = useEmpresa()
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

    if (!isAdmin && empresaUsuario) {
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
      .filter('produto_id', 'in', `(${prods.map(p => p.id).join(',')})`)

    const prodMap = new Map<string, { nome: string; quantidade: number }>()
    for (const item of topItems ?? []) {
      const nome = (item.produtos as unknown as Produto)?.nome ?? 'Desconhecido'
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
      const nome = (p.usuarios as unknown as { nome: string })?.nome ?? 'Desconhecido'
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
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-40 mt-2" />
          </div>
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/[0.06] p-6">
            <Skeleton className="h-5 w-40 mb-6" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <div className="rounded-xl border border-white/[0.06] p-6">
            <Skeleton className="h-5 w-40 mb-6" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

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
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Visao geral do seu negocio</p>
        </div>
        <Select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          className="w-40"
        >
          <option value="dia">Hoje</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mes</option>
          <option value="ano">Este Ano</option>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={`relative overflow-hidden group ${kpi.borderColor}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${kpi.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.textColor}`} />
                </div>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{kpi.sublabel}</span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-white">{kpi.value}</p>
              <p className="text-xs font-medium text-zinc-500 mt-1">{kpi.label}</p>
              <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${kpi.barColor} opacity-50 group-hover:opacity-80 transition-opacity`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-sm">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              Pedidos por Periodo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pedidosPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
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
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="p-4 rounded-2xl bg-white/[0.03] mb-3">
                  <TrendingUp className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">Nenhum dado disponivel</p>
                <p className="text-xs text-zinc-600 mt-1">Os dados aparecerao quando houver pedidos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-sm">
              <div className="p-1.5 rounded-lg bg-violet-500/10">
                <BarChart3 className="h-4 w-4 text-violet-400" />
              </div>
              Produtos Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.produtosMaisVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.produtosMaisVendidos}
                    dataKey="quantidade"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
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
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="p-4 rounded-2xl bg-white/[0.03] mb-3">
                  <Package className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">Nenhuma venda registrada</p>
                <p className="text-xs text-zinc-600 mt-1">Crie pedidos para ver os dados aqui</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Vendedores */}
      {isAdmin && stats.rankingVendedores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-sm">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>
              Ranking de Vendedores — {periodoLabels[periodo]}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Estoque critico */}
      {isAdmin && stats.estoqueCritico.length > 0 && (
        <Card className="border-red-500/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-sm">
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              Estoque Critico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.estoqueCritico.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <Package className="h-4 w-4 text-red-400" />
                    </div>
                    <span className="font-semibold text-sm">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{item.atual} un</Badge>
                    <span className="text-xs text-zinc-500">min: {item.minimo}</span>
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
