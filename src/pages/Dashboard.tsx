import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, DollarSign, Package, AlertTriangle, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { Pedido, Produto } from '@/types/database'

interface DashboardStats {
  totalPedidos: number
  valorTotal: number
  totalProdutos: number
  estoqueBaixo: number
  pedidosPorMes: { mes: string; total: number; valor: number }[]
  produtosMaisVendidos: { nome: string; quantidade: number }[]
  estoqueCritico: { nome: string; atual: number; minimo: number }[]
}

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93bbfd', '#bfdbfe']

export default function Dashboard() {
  const { usuario } = useAuth()
  const { empresa, empresaUsuario, isAdmin, hierarquiaOrdem } = useEmpresa()
  const [stats, setStats] = useState<DashboardStats>({
    totalPedidos: 0,
    valorTotal: 0,
    totalProdutos: 0,
    estoqueBaixo: 0,
    pedidosPorMes: [],
    produtosMaisVendidos: [],
    estoqueCritico: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (empresa && usuario) fetchStats()
  }, [empresa, usuario])

  async function fetchStats() {
    // Fetch pedidos
    let pedidosQuery = supabase
      .from('pedidos')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .neq('status', 'cancelado')

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

    // Fetch produtos & estoque
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

    // Fetch top products by sales
    const { data: topItems } = await supabase
      .from('pedido_itens')
      .select('produto_id, quantidade, produtos(nome)')
      .eq('produtos.empresa_id', empresa!.id)

    const prodMap = new Map<string, { nome: string; quantidade: number }>()
    for (const item of topItems ?? []) {
      const nome = (item.produtos as unknown as Produto)?.nome ?? 'Desconhecido'
      const existing = prodMap.get(item.produto_id) ?? { nome, quantidade: 0 }
      existing.quantidade += item.quantidade
      prodMap.set(item.produto_id, existing)
    }

    const produtosMaisVendidos = Array.from(prodMap.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5)

    setStats((prev) => ({
      ...prev,
      totalProdutos: prods?.length ?? 0,
      estoqueBaixo,
      estoqueCritico: estoqueCritico.slice(0, 5),
      produtosMaisVendidos,
    }))

    setLoading(false)
  }

  function processPedidos(pedidos: Pedido[]) {
    const totalPedidos = pedidos.length
    const valorTotal = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0)

    // Group by month
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

    setStats((prev) => ({ ...prev, totalPedidos, valorTotal, pedidosPorMes }))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Pedidos</p>
              <p className="text-2xl font-bold">{stats.totalPedidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-purple-100">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Produtos Ativos</p>
              <p className="text-2xl font-bold">{stats.totalProdutos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estoque Baixo</p>
              <p className="text-2xl font-bold">{stats.estoqueBaixo}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos por mês */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pedidos por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pedidosPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.pedidosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(value: number, name: string) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? 'Valor' : 'Pedidos']} />
                  <Bar dataKey="total" fill="#2563eb" name="Pedidos" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Produtos mais vendidos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.produtosMaisVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.produtosMaisVendidos}
                    dataKey="quantidade"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ nome, quantidade }) => `${nome}: ${quantidade}`}
                  >
                    {stats.produtosMaisVendidos.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhuma venda registrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estoque crítico */}
      {isAdmin && stats.estoqueCritico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Estoque Crítico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.estoqueCritico.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <span className="font-medium">{item.nome}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{item.atual} un</Badge>
                    <span className="text-sm text-muted-foreground">mín: {item.minimo}</span>
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
