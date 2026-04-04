import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, DollarSign, Package, AlertTriangle, TrendingUp, Trophy, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
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

    let estoqueBaixo = 0
    const estoqueCritico: DashboardStats['estoqueCritico'] = []

    if (prods) {
      for (const p of prods) {
        const { data: movs } = await supabase
          .from('estoque_movimentacoes')
          .select('tipo, quantidade')
          .eq('produto_id', p.id)

        let estoque = 0
        for (const m of movs ?? []) {
          if (m.tipo === 'entrada' || m.tipo === 'cancelamento') estoque += m.quantidade
          else if (m.tipo === 'saida') estoque -= m.quantidade
          else if (m.tipo === 'ajuste') estoque = m.quantidade
        }

        if (estoque <= p.estoque_minimo) {
          estoqueBaixo++
          estoqueCritico.push({ nome: p.nome, atual: estoque, minimo: p.estoque_minimo })
        }
      }
    }

    const { data: topItems } = await supabase
      .from('pedido_itens')
      .select('produto_id, quantidade, produtos(nome)')

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
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  const kpis = [
    {
      label: `Pedidos (${periodoLabels[periodo]})`,
      value: stats.totalPedidos.toString(),
      icon: ShoppingCart,
      color: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: 'Valor Total',
      value: formatCurrency(stats.valorTotal),
      icon: DollarSign,
      color: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      label: 'Produtos Ativos',
      value: stats.totalProdutos.toString(),
      icon: Package,
      color: 'from-violet-500 to-violet-600',
      bgLight: 'bg-violet-50',
      textColor: 'text-violet-600',
    },
    {
      label: 'Estoque Baixo',
      value: stats.estoqueBaixo.toString(),
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgLight: 'bg-red-50',
      textColor: 'text-red-600',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visao geral do seu negocio</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="relative overflow-hidden group hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${kpi.bgLight} transition-transform group-hover:scale-110`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.textColor}`} />
                </div>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.color} opacity-60`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <TrendingUp className="h-4 w-4 text-blue-600" />
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
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(value: number, name: string) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? 'Valor' : 'Pedidos']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorTotal)" name="Pedidos" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Nenhum dado disponivel</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-lg bg-violet-50">
                <Package className="h-4 w-4 text-violet-600" />
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
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    label={({ nome, quantidade }) => `${nome}: ${quantidade}`}
                  >
                    {stats.produtosMaisVendidos.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Nenhuma venda registrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Vendedores */}
      {isAdmin && stats.rankingVendedores.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-lg bg-amber-50">
                <Trophy className="h-4 w-4 text-amber-600" />
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
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-slate-100 text-slate-600' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {i + 1}
                        </div>
                      ) : (
                        <span className="text-muted-foreground pl-2">{i + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{v.nome}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{v.pedidos}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(v.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Estoque critico */}
      {isAdmin && stats.estoqueCritico.length > 0 && (
        <Card className="border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-lg bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              Estoque Critico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.estoqueCritico.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-red-50/50 border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <Package className="h-4 w-4 text-red-500" />
                    </div>
                    <span className="font-medium text-sm">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{item.atual} un</Badge>
                    <span className="text-xs text-muted-foreground">min: {item.minimo}</span>
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
