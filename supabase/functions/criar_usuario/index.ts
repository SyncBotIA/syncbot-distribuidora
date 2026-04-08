// Edge Function: criar_usuario
// Cria usuario no auth com Service Role Key (sem rate limit, email confirmado)
// Reutiliza contas existentes quando o email ja foi deletado da empresa

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const emailLower = email.toLowerCase().trim()

    // 1. Verificar se ja existe registro na tabela usuarios com esse email
    const { data: existingUsuario } = await supabaseAdmin
      .from('usuarios')
      .select('id, auth_id')
      .eq('email', emailLower)
      .single()

    if (existingUsuario) {
      // Usuario ja existe na tabela — reutilizar auth_id e vincular a empresa
      const authId = existingUsuario.auth_id

      // Resetar senha provisoria no auth
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        password: '123456',
      })
      if (updateError) {
        throw new Error(`Usuario existente mas falha ao resetar senha: ${updateError.message}`)
      }

      // Atualizar nome
      await supabaseAdmin.from('usuarios')
        .update({ nome, telefone: telefone || null, senha_provisoria: true })
        .eq('id', existingUsuario.id)

      // Vincular a empresa
      const { error: linkError } = await supabaseAdmin
        .from('empresa_usuarios')
        .insert({
          empresa_id,
          usuario_id: existingUsuario.id,
          hierarquia_id,
          superior_id: superior_id || null,
          ativo: true,
        })

      if (linkError) throw linkError

      return new Response(
        JSON.stringify({ success: true, email: emailLower, reutilizado: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Criar novo auth user com email ja confirmado
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password: '123456',
      email_confirm: true,
      user_metadata: { nome },
    })

    if (authError) {
      // Se ja existe no auth mas nao na tabela usuarios, buscar e vincular
      if (authError.message.includes('already')) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
        const found = listData?.users.find(u => u.email?.toLowerCase() === emailLower)
        if (found) {
          // Criar registro na tabela usuarios
          const { data: userData, error: insertError } = await supabaseAdmin
            .from('usuarios')
            .insert({
              auth_id: found.id,
              nome,
              email: emailLower,
              telefone: telefone || null,
              senha_provisoria: true,
            })
            .select()
            .single()

          if (insertError) throw insertError

          // Vincular a empresa
          const { error: linkError } = await supabaseAdmin
            .from('empresa_usuarios')
            .insert({
              empresa_id,
              usuario_id: userData.id,
              hierarquia_id,
              superior_id: superior_id || null,
              ativo: true,
            })

          if (linkError) throw linkError

          return new Response(
            JSON.stringify({ success: true, email: emailLower, reutilizado: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      throw authError
    }

    const authId = authUser.user.id

    // 3. Criar na tabela usuarios
    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_id: authId,
        nome,
        email: emailLower,
        telefone: telefone || null,
        senha_provisoria: true,
      })
      .select()
      .single()

    if (usuarioError) throw usuarioError

    // 4. Vincular a empresa
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
      JSON.stringify({ success: true, email: emailLower, reutilizado: false }),
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
