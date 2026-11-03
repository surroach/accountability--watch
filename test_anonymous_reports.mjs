#!/usr/bin/env node
/**
 * Test that anonymous reports do NOT persist contact details.
 * Identified reports DO persist contact details.
 * 
 * Tests:
 * 1. Anonymous report: contact fields must be NULL even if provided
 * 2. Identified report: contact fields must be retained
 * 
 * Uses:
 * - Actual db/schema.sql
 * - Actual src/server/report-repository.mjs
 * - Unique temporary databases
 * - Fictional data only
 * - Direct SQL queries to verify storage
 */

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'node:assert';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createReportRepository } from './src/server/report-repository.ts';

console.log('\n' + '='.repeat(70));
console.log('Anonymous vs Identified Report Tests');
console.log('='.repeat(70) + '\n');

const schema = readFileSync('db/schema.sql', 'utf-8');

// Test 1: Anonymous report must NOT persist contact details
test('Anonymous report: contact fields must be NULL in database', async (t) => {
  let tempTestDir = null;
  let db = null;
  let testError = null;

  try {
    console.log('📁 Creating temporary database for anonymous test...');
    const prefix = join(tmpdir(), 'accountability-watch-anon-test-');
    tempTestDir = await mkdtemp(prefix);
    const dbPath = join(tempTestDir, 'test.db');
    console.log(`✓ Created: ${tempTestDir}\n`);

    // Setup database
    console.log('🔌 Initializing database...');
    db = new DatabaseSync(dbPath);
    db.exec(schema);
    console.log('✓ Schema executed\n');

    // Create repository
    const repo = createReportRepository(db);

    // Insert anonymous report WITH contact details
    console.log('📝 Test: Insert anonymous report WITH contact details...');
    const anonReport = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Downtown Main Street',
      description: 'Witnessed incident at protest',
      submission_mode: 'anonymous',
      // These should NOT be saved for anonymous reports:
      witness_name: 'John Doe',
      witness_contact: 'john@example.com',
      reporter_name: 'Jane Smith',
      reporter_contact: 'jane@example.com',
    };

    const inserted = repo.insertReport(anonReport);
    const reportId = inserted.id;
    console.log(`✓ Report inserted: ${reportId}\n`);

    // Query directly from database to verify storage
    console.log('🔍 Querying database directly to check stored values...');
    const directStmt = db.prepare(`
      SELECT witness_name, witness_contact, reporter_name, reporter_contact
      FROM incident_reports
      WHERE id = ?
    `);
    const storedRow = directStmt.get(reportId);
    console.log('Stored database values:');
    console.log(`  witness_name: ${storedRow.witness_name}`);
    console.log(`  witness_contact: ${storedRow.witness_contact}`);
    console.log(`  reporter_name: ${storedRow.reporter_name}`);
    console.log(`  reporter_contact: ${storedRow.reporter_contact}\n`);

    // Verify all contact fields are NULL
    console.log('✓ Verifying contact fields are NULL...');
    strictEqual(
      storedRow.witness_name,
      null,
      'Anonymous report: witness_name must be NULL in database'
    );
    strictEqual(
      storedRow.witness_contact,
      null,
      'Anonymous report: witness_contact must be NULL in database'
    );
    strictEqual(
      storedRow.reporter_name,
      null,
      'Anonymous report: reporter_name must be NULL in database'
    );
    strictEqual(
      storedRow.reporter_contact,
      null,
      'Anonymous report: reporter_contact must be NULL in database'
    );
    console.log('✓ All contact fields are NULL as expected\n');

    // Also verify repository read does not return these
    console.log('✓ Verifying repository read does not return contact details...');
    const readReport = repo.readReportById(reportId);
    strictEqual(
      readReport.witness_name,
      null,
      'Anonymous report: repository read should return null for witness_name'
    );
    strictEqual(
      readReport.witness_contact,
      null,
      'Anonymous report: repository read should return null for witness_contact'
    );
    strictEqual(
      readReport.reporter_name,
      null,
      'Anonymous report: repository read should return null for reporter_name'
    );
    strictEqual(
      readReport.reporter_contact,
      null,
      'Anonymous report: repository read should return null for reporter_contact'
    );
    console.log('✓ Repository read correctly returns nulls\n');

    console.log('='.repeat(70));
    console.log('✅ ANONYMOUS TEST PASSED');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    testError = err;
    console.error('\n' + '='.repeat(70));
    console.error('❌ ANONYMOUS TEST FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${err.message}\n`);
  } finally {
    if (db) {
      try {
        db.close();
        db = null;
      } catch (err) {
        console.error(`⚠ Error closing connection: ${err.message}`);
      }
    }

    if (tempTestDir) {
      try {
        await rm(tempTestDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error(`❌ Error removing temporary directory: ${cleanupErr.message}`);
        if (!testError) {
          throw cleanupErr;
        }
      }
    }

    if (testError) {
      throw testError;
    }
  }
});

// Test 2: Identified report MUST persist contact details
test('Identified report: contact fields must be retained', async (t) => {
  let tempTestDir = null;
  let db = null;
  let testError = null;

  try {
    console.log('📁 Creating temporary database for identified test...');
    const prefix = join(tmpdir(), 'accountability-watch-identified-test-');
    tempTestDir = await mkdtemp(prefix);
    const dbPath = join(tempTestDir, 'test.db');
    console.log(`✓ Created: ${tempTestDir}\n`);

    // Setup database
    console.log('🔌 Initializing database...');
    db = new DatabaseSync(dbPath);
    db.exec(schema);
    console.log('✓ Schema executed\n');

    // Create repository
    const repo = createReportRepository(db);

    // Insert identified report WITH contact details
    console.log('📝 Test: Insert identified report WITH contact details...');
    const identifiedReport = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Downtown Main Street',
      description: 'Witnessed incident at protest',
      submission_mode: 'identified',
      // These SHOULD be saved for identified reports:
      witness_name: 'Alice Johnson',
      witness_contact: 'alice@example.com',
      reporter_name: 'Bob Wilson',
      reporter_contact: 'bob@example.com',
    };

    const inserted = repo.insertReport(identifiedReport);
    const reportId = inserted.id;
    console.log(`✓ Report inserted: ${reportId}\n`);

    // Query directly from database to verify storage
    console.log('🔍 Querying database directly to check stored values...');
    const directStmt = db.prepare(`
      SELECT witness_name, witness_contact, reporter_name, reporter_contact
      FROM incident_reports
      WHERE id = ?
    `);
    const storedRow = directStmt.get(reportId);
    console.log('Stored database values:');
    console.log(`  witness_name: ${storedRow.witness_name}`);
    console.log(`  witness_contact: ${storedRow.witness_contact}`);
    console.log(`  reporter_name: ${storedRow.reporter_name}`);
    console.log(`  reporter_contact: ${storedRow.reporter_contact}\n`);

    // Verify contact fields are retained
    console.log('✓ Verifying contact fields are retained...');
    strictEqual(
      storedRow.witness_name,
      'Alice Johnson',
      'Identified report: witness_name must be stored'
    );
    strictEqual(
      storedRow.witness_contact,
      'alice@example.com',
      'Identified report: witness_contact must be stored'
    );
    strictEqual(
      storedRow.reporter_name,
      'Bob Wilson',
      'Identified report: reporter_name must be stored'
    );
    strictEqual(
      storedRow.reporter_contact,
      'bob@example.com',
      'Identified report: reporter_contact must be stored'
    );
    console.log('✓ All contact fields are retained as expected\n');

    // Verify repository read returns these
    console.log('✓ Verifying repository read returns contact details...');
    const readReport = repo.readReportById(reportId);
    strictEqual(
      readReport.witness_name,
      'Alice Johnson',
      'Identified report: repository read should return witness_name'
    );
    strictEqual(
      readReport.witness_contact,
      'alice@example.com',
      'Identified report: repository read should return witness_contact'
    );
    strictEqual(
      readReport.reporter_name,
      'Bob Wilson',
      'Identified report: repository read should return reporter_name'
    );
    strictEqual(
      readReport.reporter_contact,
      'bob@example.com',
      'Identified report: repository read should return reporter_contact'
    );
    console.log('✓ Repository read correctly returns contact details\n');

    console.log('='.repeat(70));
    console.log('✅ IDENTIFIED TEST PASSED');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    testError = err;
    console.error('\n' + '='.repeat(70));
    console.error('❌ IDENTIFIED TEST FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${err.message}\n`);
  } finally {
    if (db) {
      try {
        db.close();
        db = null;
      } catch (err) {
        console.error(`⚠ Error closing connection: ${err.message}`);
      }
    }

    if (tempTestDir) {
      try {
        await rm(tempTestDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error(`❌ Error removing temporary directory: ${cleanupErr.message}`);
        if (!testError) {
          throw cleanupErr;
        }
      }
    }

    if (testError) {
      throw testError;
    }
  }
});
