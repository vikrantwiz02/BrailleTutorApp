// Database Connectivity Test Script
const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Database Connectivity...\n');
console.log('📍 URL:', SUPABASE_URL);
console.log('📍 Key:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDatabase() {
  const results = {
    connection: false,
    tables: {},
    rls: {},
    functions: {}
  };

  // 1. Test basic connection
  console.log('1️⃣ Testing Connection...');
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.log('   ❌ Connection failed:', error.message);
    } else {
      console.log('   ✅ Connection successful');
      results.connection = true;
    }
  } catch (err) {
    console.log('   ❌ Connection error:', err.message);
  }

  // 2. Test each table
  console.log('\n2️⃣ Testing Tables...');
  const tables = ['profiles', 'lesson_progress', 'user_analytics', 'achievements', 'device_pairings', 'chat_history', 'user_settings', 'offline_queue'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
        results.tables[table] = { exists: false, error: error.message };
      } else {
        console.log(`   ✅ ${table}: OK`);
        results.tables[table] = { exists: true, rows: data?.length || 0 };
      }
    } catch (err) {
      console.log(`   ❌ ${table}: ${err.message}`);
      results.tables[table] = { exists: false, error: err.message };
    }
  }

  // 3. Test RLS by trying to insert without auth
  console.log('\n3️⃣ Testing RLS (Row Level Security)...');
  try {
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase
      .from('lesson_progress')
      .insert({
        user_id: testUserId,
        lesson_id: 'test-lesson',
        completed: false,
        score: 0
      });
    
    if (error) {
      if (error.message.includes('violates row-level security') || error.code === '42501') {
        console.log('   ✅ RLS is working (blocking unauthenticated inserts)');
        results.rls.working = true;
      } else {
        console.log('   ⚠️ RLS Error:', error.message);
        results.rls.working = false;
        results.rls.error = error.message;
      }
    } else {
      console.log('   ⚠️ RLS may not be configured (insert succeeded without auth)');
      results.rls.working = false;
      // Clean up test data
      await supabase.from('lesson_progress').delete().eq('lesson_id', 'test-lesson');
    }
  } catch (err) {
    console.log('   ❌ RLS test error:', err.message);
  }

  // 4. Test database functions
  console.log('\n4️⃣ Testing Database Functions...');
  const functions = ['get_user_stats', 'get_weekly_progress', 'calculate_streak'];
  
  for (const func of functions) {
    try {
      const { data, error } = await supabase.rpc(func, { 
        p_user_id: '00000000-0000-0000-0000-000000000000' 
      });
      if (error) {
        console.log(`   ❌ ${func}: ${error.message}`);
        results.functions[func] = { exists: false, error: error.message };
      } else {
        console.log(`   ✅ ${func}: OK`);
        results.functions[func] = { exists: true };
      }
    } catch (err) {
      console.log(`   ❌ ${func}: ${err.message}`);
      results.functions[func] = { exists: false, error: err.message };
    }
  }

  // 5. Test authenticated flow
  console.log('\n5️⃣ Testing Auth Flow...');
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    // Try to sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { name: 'Test User' }
      }
    });

    if (signUpError) {
      console.log('   ⚠️ Sign up error:', signUpError.message);
    } else if (signUpData.user) {
      console.log('   ✅ User signup works');
      
      // Check if profile was created
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signUpData.user.id)
        .single();
      
      if (profile) {
        console.log('   ✅ Profile auto-created via trigger');
      } else {
        console.log('   ⚠️ Profile not auto-created:', profileError?.message);
      }

      // Test inserting lesson progress with auth
      const { data: progressData, error: progressError } = await supabase
        .from('lesson_progress')
        .insert({
          user_id: signUpData.user.id,
          lesson_id: 'test-lesson-auth',
          completed: true,
          score: 85,
          time_spent: 120
        })
        .select();

      if (progressError) {
        console.log('   ❌ Lesson progress insert failed:', progressError.message);
      } else {
        console.log('   ✅ Lesson progress insert works');
        // Clean up
        await supabase.from('lesson_progress').delete().eq('lesson_id', 'test-lesson-auth');
      }

      // Sign out
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.log('   ❌ Auth test error:', err.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  
  const tableCount = Object.values(results.tables).filter(t => t.exists).length;
  const funcCount = Object.values(results.functions).filter(f => f.exists).length;
  
  console.log(`   Connection: ${results.connection ? '✅' : '❌'}`);
  console.log(`   Tables: ${tableCount}/${tables.length} available`);
  console.log(`   RLS: ${results.rls.working ? '✅ Working' : '⚠️ Check config'}`);
  console.log(`   Functions: ${funcCount}/${functions.length} available`);
  
  if (tableCount < tables.length) {
    console.log('\n⚠️ Missing tables detected. Run the migration SQL in Supabase dashboard.');
  }
  if (funcCount < functions.length) {
    console.log('⚠️ Missing functions detected. Ensure full schema was deployed.');
  }
}

testDatabase().catch(console.error);
