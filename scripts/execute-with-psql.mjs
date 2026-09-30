#!/usr/bin/env node
/**
 * Execute SQL Migration using direct psql connection
 * This requires psql CLI to be installed on your system
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n╔═════════════════════════════════════════════════════════════╗');
console.log('║  EXECUTE SQL MIGRATION VIA DIRECT POSTGRESQL CONNECTION    ║');
console.log('║  Project: mtholttdmrjptulqcfyk                             ║');
console.log('╚═════════════════════════════════════════════════════════════╝\n');

// Supabase connection details
const DB_HOST = 'mtholttdmrjptulqcfyk.supabase.co';
const DB_PORT = 5432;
const DB_USER = 'postgres';
const DB_NAME = 'postgres';

// For this to work, we need the password - which we don't have from the Service Role JWT
// The JWT is for API access, not direct DB access

console.log('⚠️  LIMITATION: Direct psql requires database password\n');
console.log('The Service Role Key provided is for REST API access,');
console.log('not direct PostgreSQL connection.\n');

console.log('📋 To execute manually:\n');
console.log('Option 1️⃣: Via Supabase Dashboard (Recommended)');
console.log('  1. Go to: https://app.supabase.com');
console.log('  2. Project: mtholttdmrjptulqcfyk');
console.log('  3. SQL Editor → New Query');
console.log('  4. Copy file: docs/deployment/FIX_ALL_CRITICAL.sql');
console.log('  5. Click Run\n');

console.log('Option 2️⃣: Via psql CLI');
console.log('  1. Install psql: brew install postgresql (macOS) or apt install postgresql-client (Linux)');
console.log('  2. Get password from Supabase Dashboard');
console.log('  3. Run: psql -h mtholttdmrjptulqcfyk.supabase.co -U postgres -d postgres');
console.log('  4. Paste SQL commands\n');

console.log('Option 3️⃣: Via Node.js pg library');
console.log('  npm install pg');
console.log('  Then use: scripts/execute-with-pg-library.mjs\n');

// Try to find psql
const psqlProcess = spawn('psql', ['--version']);

psqlProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ psql is available on your system');
    console.log('\nTo execute migration directly:');
    console.log('  PGPASSWORD=$DB_PASSWORD psql -h mtholttdmrjptulqcfyk.supabase.co -U postgres -d postgres -f docs/deployment/FIX_ALL_CRITICAL.sql\n');
  } else {
    console.log('❌ psql not found - install PostgreSQL client tools');
  }
});

psqlProcess.stderr.on('data', (data) => {
  if (data.toString().includes('psql not found')) {
    console.log('psql not installed');
  }
});
