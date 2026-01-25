#!/usr/bin/env node
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const sql = fs.readFileSync('supabase/schema.sql', 'utf8');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

console.log('🗄️ Deploying database schema to Supabase...');

// Using raw SQL execution via PostgREST
fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: sql })
})
.then(response => {
  console.log('Response status:', response.status);
  return response.text();
})
.then(text => {
  console.log('Response:', text);
})
.catch(err => {
  console.error('Error:', err.message);
  console.log('\n🔧 Alternative: Use Supabase Dashboard to run the SQL manually:');
  console.log(`Go to: ${url.replace('/rest/v1', '')}/project/default/sql/new`);
  console.log('Then paste the contents of supabase/schema.sql and run it.');
});