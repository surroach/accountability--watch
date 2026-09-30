#!/usr/bin/env node
/**
 * Initialize SQLite database for Accountability Watch
 * Run once to set up local development database
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'accountability.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║   Accountability Watch - Database Initialization  ║');
console.log('╚════════════════════════════════════════════════════╝\n');

console.log(`📂 Database path: ${DB_PATH}`);
console.log(`📄 Schema path: ${SCHEMA_PATH}\n`);

// Read schema
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error(`❌ Schema file not found: ${SCHEMA_PATH}`);
  process.exit(1);
}

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Failed to connect:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite\n');
});

// Execute schema
console.log('⏳ Creating tables...\n');

db.exec(schema, (err) => {
  if (err) {
    console.error('❌ Schema execution failed:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('✅ Tables created successfully\n');

  // Verify tables
  db.all(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
    if (err) {
      console.error('❌ Verification failed:', err.message);
      db.close();
      process.exit(1);
    }

    console.log('📋 Tables created:');
    tables.forEach(t => console.log(`   ✓ ${t.name}`));

    console.log('\n✅ Database initialized successfully!\n');
    db.close();
    process.exit(0);
  });
});
