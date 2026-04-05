import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ouxggojgvaqfigdvsuop.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_q4DvoXoq6eidP5wwH-5cRg_v0OW4N5-';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSignup() {
  console.log('\n=== TEST 1: Create Account ===');
  const email = `test_${Date.now()}@test.com`;
  const password = 'senha123';

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    console.log('SIGNUP ERROR:', error.message);
    return null;
  }
  console.log('Sign up OK:', data.user?.email);
  // Cleanup - delete test user
  return data.user;
}

async function testLogin(email, password) {
  console.log('\n=== TEST 2: Login ===');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.log('LOGIN ERROR:', error.message);
    return null;
  }
  console.log('Login OK:', data.user?.email);
  return data.session;
}

async function testTables() {
  console.log('\n=== TEST 3: Table Access ===');
  const tables = ['empresas', 'usuarios', 'hierarquias', 'produtos', 'clientes', 'pedidos', 'estoque_movimentacoes', 'pedido_itens', 'empresa_usuarios', 'categorias'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`  Table "${table}" ERROR: ${error.message}`);
    } else {
      console.log(`  Table "${table}" OK - ${data?.length ?? 0} rows`);
    }
  }
}

async function testRPCs() {
  console.log('\n=== TEST 4: RPC Functions ===');
  const rpcs = [
    { name: 'get_subordinados', args: { p_empresa_usuario_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'get_estoque_atual', args: { p_produto_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'get_user_hierarquia_ordem', args: { p_auth_id: '00000000-0000-0000-0000-000000000000', p_empresa_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'is_superior_of', args: { p_auth_id: '00000000-0000-0000-0000-000000000000', p_target_empresa_usuario_id: '00000000-0000-0000-0000-000000000000' } },
  ];
  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc.name, rpc.args);
    if (error) {
      console.log(`  RPC "${rpc.name}" ERROR: ${error.message}`);
    } else {
      console.log(`  RPC "${rpc.name}" OK`);
    }
  }
}

async function main() {
  console.log('=== SUPABASE FUNCTIONALITY TEST ===');

  await testTables();
  await testRPCs();

  const user = await testSignup();
  if (user) {
    await testTables();
    await testRPCs();

    const session = await testLogin(user.email, 'senha123');
    if (session) {
      console.log('\nSession user:', session.user);
    }
  }

  console.log('\n=== TESTS COMPLETE ===');
}

main().catch(console.error);
