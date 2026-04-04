// Edge Function: criar_usuario
// Usa o Service Role Key para criar o usuario no auth sem rate limit
// e com email ja confirmado

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { empresa_id, nome, email, telefone, hierarquia_id, superior_id } = await req.json()

    if (!empresa_id || !nome || !email || !hierarquia_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: empresa_id, nome, email, hierarquia_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client com Service Role Key (ignora rate limits e RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // 1. Criar auth user com email confirmado e senha provisoria
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: '123456',
      email_confirm: true, // Sem necessidade de confirmar
      user_metadata: { nome },
    })

    if (authError && !authError.message.includes('already been registered')) {
      throw authError
    }

    const authId = authUser?.user?.id

    if (!authId) {
      // Usuario ja existe, buscar o ID
      const { data: existing } = await supabaseAdmin
        .from('usuarios')
        .select('auth_id')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (existing?.auth_id) {
        throw new Error(`Ja existe um usuario com o email ${email}`)
      }
      throw new Error('Nao foi possivel obter o ID do usuario')
    }

    // 2. Criar/verificar na tabela usuarios
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('auth_id', authId.trim())
      .single()

    if (checkError && checkError.code !== 'PGRST116') throw checkError

    if (existingUser) {
      throw new Error(`Usuario com email ${email} ja esta cadastrado`)
    }

    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_id: authId.trim(),
        nome,
        email: email.toLowerCase().trim(),
        telefone: telefone || null,
        senha_provisoria: true,
      })
      .select()
      .single()

    if (usuarioError) throw usuarioError

    // 3. Vincular a empresa
    const { error: linkError } = await supabaseAdmin
      .from('empresa_usuarios')
      .insert({
        empresa_id,
        usuario_id: usuarioData.id,
        hierarquia_id,
        superior_id: superior_id || null,
        ativo: true,
      })

    if (linkError) throw linkError

    return new Response(
      JSON.stringify({
        success: true,
        email: email.toLowerCase().trim(),
        reutilizado: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
