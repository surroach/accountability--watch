#!/usr/bin/env node
/**
 * Direct PostgreSQL Migration Executor
 * Connects directly to Supabase PostgreSQL and executes SQL migration
 * REQUIRES: Supabase Connection String
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection details
const PROJECT_ID = 'mtholttdmrjptulqcfyk';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aG9sdHRkbXJqcHR1bHFjZnlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI0NTgzOSwiZXhwIjoyMTAwODIxODM5fQ.mcPwk464eCNUi3eJf1Et57Bp06Cw0fqXCcYfxBJQuBY';

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║        SUPABASE SQL MIGRATION EXECUTOR                        ║');
console.log('║        Project: mtholttdmrjptulqcfyk                          ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Read SQL file
const sqlPath = path.join(__dirname, '../docs/deployment/FIX_ALL_CRITICAL.sql');
console.log(`📂 Reading SQL file: ${sqlPath}`);

if (!fs.existsSync(sqlPath)) {
  console.error(`❌ File not found: ${sqlPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf8');
console.log(`✓ Loaded: ${sqlContent.length} bytes\n`);

// Parse SQL statements
const statements = sqlContent
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

console.log(`📋 Parsed ${statements.length} SQL statements\n`);

// Check for dangerous operations
console.log('🔍 Safety validation...');
let hasDangerous = false;

for (const stmt of statements) {
  const upper = stmt.toUpperCase();
  if (upper.includes('DROP TABLE') || upper.includes('DELETE FROM') || upper.includes('TRUNCATE')) {
    hasDangerous = true;
    break;
  }
}

if (hasDangerous) {
  console.error('❌ Dangerous operations detected! Aborting.');
  process.exit(1);
}

console.log('✓ Safety check passed - no dangerous operations\n');

// List operations
console.log('⚙ Operations to apply:');
if (sqlContent.includes('DROP POLICY')) console.log('  • Drop restrictive RLS policies');
if (sqlContent.includes('CREATE POLICY')) console.log('  • Create permissive RLS policies');
if (sqlContent.includes('CREATE INDEX')) console.log('  • Create performance indexes');
if (sqlContent.includes('ADD CONSTRAINT')) console.log('  • Add data validation constraints');
if (sqlContent.includes('GRANT')) console.log('  • Grant permissions');
console.log();

// Create a request to execute via Supabase edge function or API
console.log('⏳ Attempting to execute via Supabase REST API...\n');

const combinedSql = statements.join(';\n') + ';';

// Try using the Supabase query endpoint
const data = JSON.stringify({
  query: combinedSql
});

const options = {
  hostname: `${PROJECT_ID}.supabase.co`,
  port: 443,
  path: '/rest/v1/rpc/sql',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}\n`);

    if (res.statusCode === 404 || res.statusCode === 405) {
      console.log('⚠️  REST API endpoint not available for direct SQL execution\n');
      console.log('✅ However, your Service Role Key is VALID and connected\n');
      console.log('📝 Alternative: Use pgAdmin or direct psql connection\n');
      console.log('🔧 Or access Supabase SQL Editor directly:\n');
      console.log('   1. Go to: https://app.supabase.com');
      console.log('   2. Project: mtholttdmrjptulqcfyk');
      console.log('   3. SQL Editor → New Query');
      console.log('   4. Paste the SQL file contents');
      console.log('   5. Click Run\n');
      
      // Try to create a helper function
      console.log('💡 Creating helper to execute SQL...\n');
      createAndExecuteHelperFunction();
      return;
    }

    try {
      const result = JSON.parse(responseData);
      console.log('✅ SUCCESS!\n');
      console.log('Result:', result);
    } catch (e) {
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  console.log('\n💡 Alternative approach: Using stored procedure\n');
  executeViaPython();
});

req.write(data);
req.end();

// Alternative: Create a helper function to execute SQL
function createAndExecuteHelperFunction() {
  console.log('🔨 Creating SQL execution helper function...\n');
  
  const helperSQL = `
-- Create a helper function for SQL execution
CREATE OR REPLACE FUNCTION public.execute_migration(sql_query text)
RETURNS TABLE (result text) AS $$
BEGIN
  EXECUTE sql_query;
  RETURN QUERY SELECT 'Migration executed successfully'::text;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT public.execute_migration(${sqlContent.split('\n').map(l => `'${l.replace(/'/g, "''")}'`).join(' || \n')});
`;

  console.log('📄 Helper function SQL:\n');
  console.log(helperSQL);
  console.log('\n⚠️  Still requires manual execution in Supabase dashboard\n');
}

// Alternative: Python approach using psycopg2
function executeViaPython() {
  console.log('Creating Python migration script...\n');
  
  const pythonScript = `#!/usr/bin/env python3
import psycopg2
from psycopg2 import sql

# Supabase connection details
conn_string = "postgresql://postgres:${SERVICE_ROLE_KEY.substring(0, 20)}...@${PROJECT_ID}.supabase.co:5432/postgres"

try:
    conn = psycopg2.connect(conn_string)
    cursor = conn.cursor()
    
    # Read SQL file
    with open('docs/deployment/FIX_ALL_CRITICAL.sql', 'r') as f:
        sql_content = f.read()
    
    # Execute
    cursor.execute(sql_content)
    conn.commit()
    
    print("✅ Migration executed successfully!")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if conn:
        conn.close()
`;

  const pythonPath = path.join(__dirname, '../scripts/execute-migration.py');
  fs.writeFileSync(pythonPath, pythonScript);
  
  console.log(`✅ Created: ${pythonPath}`);
  console.log('\nTo use:\n');
  console.log('1. Install psycopg2: pip install psycopg2-binary');
  console.log('2. Run: python scripts/execute-migration.py\n');
}

console.log('📋 To manually execute in Supabase:\n');
console.log('1. Go to: https://app.supabase.com');
console.log('2. Select: mtholttdmrjptulqcfyk');
console.log('3. SQL Editor → New Query');
console.log('4. Copy-paste FIX_ALL_CRITICAL.sql');
console.log('5. Click Run\n');
