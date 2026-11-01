/**
 * Local SQLite database initialization and connection management
 * Uses Node 24 built-in sqlite module
 * Supports test isolation via ACCOUNTABILITY_DB_PATH environment variable
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Support test isolation via environment variable
const dbPath = process.env.ACCOUNTABILITY_DB_PATH || join(__dirname, '../../db/accountability.db');
const schemaPath = join(__dirname, '../../db/schema.sql');

let dbInstance = null;

/**
 * Initialize database connection with schema
 * Creates db/accountability.db if it doesn't exist
 * Loads schema on first creation
 * @returns {DatabaseSync} SQLite database connection
 */
export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    
    // Enable foreign keys
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    
    // Load schema if database is empty
    try {
      const tables = dbInstance.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='incident_reports'"
      ).all();
      
      if (tables.length === 0) {
        console.log('📝 Initializing database schema...');
        const schema = readFileSync(schemaPath, 'utf-8');
        dbInstance.exec(schema);
        console.log('✓ Database schema loaded');
      }
    } catch (err) {
      console.error('❌ Error initializing database:', err);
      throw err;
    }
  }
  
  return dbInstance;
}

/**
 * Close database connection
 * Useful for cleanup in tests or graceful shutdown
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
