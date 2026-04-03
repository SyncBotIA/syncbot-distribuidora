import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { UserPlus } from 'lucide-react'
import type { EmpresaUsuario, Hierarquia } from '@/types/database'

export default function Usuarios() {
  const { usuario } = useAuth()
  const { empresa, empresaUsuario, hierarquiaOrdem, isAdmin } = useEmpresa()
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<EmpresaUsuario[]>([])
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Form state
  const [formNome, setFormNome] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formSenha, setFormSenha] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [formHierarquiaId, setFormHierarquiaId] = useState('')
  const [formSuperiorId, setFormSuperiorId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (empresa) {
      fetchUsuarios()
      fetchHierarquias()
    }
  }, [empresa])

  async function fetchUsuarios() {
    const { data } = await supabase
      .from('empresa_usuarios')
      .select('*, usuarios(*), hierarquias(*)')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)

    let result = data ?? []

    if (!isAdmin && empresaUsuario) {
      const { data: subs } = await supabase.rpc('get_subordinados', {
        p_empresa_usuario_id: empresaUsuario.id,
      })
      const subIds = new Set((subs ?? []).map((s: { id: string }) => s.id))
      subIds.add(empresaUsuario.id)
      result = result.filter((eu) => subIds.has(eu.id))
    }

    setUsuarios(result)
    setLoading(false)
  }

  async function fetchHierarquias() {
    const { data } = await supabase
      .from('hierarquias')
      .select('*')
      .eq('empresa_id', empresa!.id)
      .eq('ativo', true)
      .order('ordem')

    setHierarquias(data ?? [])
  }

  const availableHierarquias = hierarquias.filter(
    (h) => hierarquiaOrdem !== null && h.ordem > hierarquiaOrdem
  )

  const availableSuperiors = usuarios.filter((eu) => {
    if (!formHierarquiaId) return false
    const selectedH = hierarquias.find((h) => h.id === formHierarquiaId)
    if (!selectedH) return false
    const euH = eu.hierarquias as unknown as Hierarquia
    return euH && euH.ordem < selectedH.ordem
  })

  async function handleInvite() {
    if (!empresa || !usuario) return
    if (!formSenha || formSenha.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.rpc('convidar_usuario', {
        p_empresa_id: empresa.id,
        p_nome: formNome,
        p_email: formEmail,
        p_senha: formSenha,
        p_telefone: formTelefone || null,
        p_hierarquia_id: formHierarquiaId,
        p_superior_id: formSuperiorId || null,
      })

      if (error) throw error

      toast({ title: 'Usuario criado com sucesso', description: `Email: ${formEmail} / Senha: ${formSenha}`, variant: 'success' })
      setDialogOpen(false)
      fetchUsuarios()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao convidar'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const filtered = usuarios.filter((eu) => {
    const u = eu.usuario
    if (!u) return false
    const q = search.toLowerCase()
    return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        {availableHierarquias.length > 0 && (
          <Button onClick={() => {
            setDialogOpen(true)
            setFormNome(''); setFormEmail(''); setFormSenha(''); setFormTelefone('')
            setFormHierarquiaId(''); setFormSuperiorId('')
          }} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        )}
      </div>

      <Input
        placeholder="Buscar por nome ou email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Hierarquia</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((eu) => {
                  const u = eu.usuario
                  const h = eu.hierarquias as unknown as Hierarquia
                  return (
                    <TableRow key={eu.id}>
                      <TableCell className="font-medium">{u?.nome ?? '—'}</TableCell>
                      <TableCell>{u?.email ?? '—'}</TableCell>
                      <TableCell>{u?.telefone ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{h?.nome ?? '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={eu.ativo ? 'success' : 'secondary'}>
                          {eu.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum usuario encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Convidar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha de acesso</Label>
              <Input type="text" value={formSenha} onChange={(e) => setFormSenha(e.target.value)} placeholder="Minimo 6 caracteres" />
              <p className="text-xs text-muted-foreground">O usuario pode alterar depois em Configuracoes</p>
            </div>
            <div className="space-y-2">
              <Label>Telefone (opcional)</Label>
              <Input value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Hierarquia</Label>
              <Select value={formHierarquiaId} onChange={(e) => setFormHierarquiaId(e.target.value)}>
                <option value="">Selecione...</option>
                {availableHierarquias.map((h) => (
                  <option key={h.id} value={h.id}>{h.nome} (ordem {h.ordem})</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Superior direto (opcional)</Label>
              <Select value={formSuperiorId} onChange={(e) => setFormSuperiorId(e.target.value)}>
                <option value="">Nenhum</option>
                {availableSuperiors.map((eu) => (
                  <option key={eu.id} value={eu.id}>{eu.usuario?.nome}</option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!formNome || !formEmail || !formSenha || !formHierarquiaId || saving}>
              {saving ? 'Criando...' : 'Criar Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
