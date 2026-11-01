#!/usr/bin/env node
/**
 * Test edge cases for submission_mode handling in anonymous reports.
 * 
 * Verifies that when submission_mode defaults to "anonymous",
 * contact details are ALWAYS removed, not just when explicitly set to "anonymous".
 * 
 * Tests:
 * 1. submission_mode omitted - should default to anonymous, contact NULL
 * 2. submission_mode null - should default to anonymous, contact NULL
 * 3. submission_mode empty string - should default to anonymous, contact NULL
 * 4. submission_mode explicitly "anonymous" - contact NULL
 * 5. submission_mode "identified" - contact retained
 * 6. submission_mode unsupported value - should be rejected
 * 7. Input object is not mutated
 * 
 * Uses:
 * - Actual db/schema.sql
 * - Actual src/server/report-repository.mjs
 * - Unique temporary databases per test
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
console.log('Submission Mode Edge Cases - Default to Anonymous Tests');
console.log('='.repeat(70) + '\n');

const schema = readFileSync('db/schema.sql', 'utf-8');

// Helper to create and cleanup a test database
async function setupTestDb(testName) {
  const prefix = join(tmpdir(), `accountability-watch-mode-test-`);
  const tempTestDir = await mkdtemp(prefix);
  const dbPath = join(tempTestDir, 'test.db');
  const db = new DatabaseSync(dbPath);
  db.exec(schema);
  return { tempTestDir, dbPath, db };
}

// Helper to cleanup
async function cleanupTestDb(db, tempTestDir) {
  if (db) {
    try {
      db.close();
    } catch (err) {
      console.error(`⚠ Error closing connection: ${err.message}`);
    }
  }
  if (tempTestDir) {
    try {
      await rm(tempTestDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`⚠ Error removing temporary directory: ${err.message}`);
    }
  }
}

// Helper to verify NULL contact fields
function verifyNullContactFields(storedRow, testContext) {
  strictEqual(
    storedRow.witness_name,
    null,
    `${testContext}: witness_name must be NULL`
  );
  strictEqual(
    storedRow.witness_contact,
    null,
    `${testContext}: witness_contact must be NULL`
  );
  strictEqual(
    storedRow.reporter_name,
    null,
    `${testContext}: reporter_name must be NULL`
  );
  strictEqual(
    storedRow.reporter_contact,
    null,
    `${testContext}: reporter_contact must be NULL`
  );
}

// Test 1: submission_mode omitted
test('submission_mode omitted: should default to anonymous, contact NULL', async (t) => {
  let { tempTestDir, db } = await setupTestDb('omitted');
  let testError = null;

  try {
    console.log('📝 Test 1: submission_mode OMITTED');
    const repo = createReportRepository(db);

    const reportData = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Test Location',
      description: 'Test description',
      // submission_mode OMITTED
      witness_name: 'Alice Test',
      witness_contact: 'alice@test.com',
      reporter_name: 'Bob Test',
      reporter_contact: 'bob@test.com',
    };

    const inserted = repo.insertReport(reportData);
    
    const directStmt = db.prepare(`
      SELECT submission_mode, witness_name, witness_contact, reporter_name, reporter_contact
      FROM incident_reports
      WHERE id = ?
    `);
    const storedRow = directStmt.get(inserted.id);
    
    console.log(`  Stored submission_mode: ${storedRow.submission_mode}`);
    console.log(`  Stored witness_name: ${storedRow.witness_name}`);
    
    strictEqual(storedRow.submission_mode, 'anonymous', 'Should default to anonymous');
    verifyNullContactFields(storedRow, 'Omitted mode');
    console.log('✅ PASSED\n');

  } catch (err) {
    testError = err;
    console.error(`❌ FAILED: ${err.message}\n`);
  } finally {
    await cleanupTestDb(db, tempTestDir);
    if (testError) throw testError;
  }
});

// Test 2: submission_mode null
test('submission_mode null: should default to anonymous, contact NULL', async (t) => {
  let { tempTestDir, db } = await setupTestDb('null');
  let testError = null;

  try {
    console.log('📝 Test 2: submission_mode SET TO null');
    const repo = createReportRepository(db);

    const reportData = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Test Location',
      description: 'Test description',
      submission_mode: null,
      witness_name: 'Alice Test',
      witness_contact: 'alice@test.com',
      reporter_name: 'Bob Test',
      reporter_contact: 'bob@test.com',
    };

    const inserted = repo.insertReport(reportData);
    
    const directStmt = db.prepare(`
      SELECT submission_mode, witness_name, witness_contact, reporter_name, reporter_contact
      FROM incident_reports
      WHERE id = ?
    `);
    const storedRow = directStmt.get(inserted.id);
    
    console.log(`  Stored submission_mode: ${storedRow.submission_mode}`);
    console.log(`  Stored witness_name: ${storedRow.witness_name}`);
    
    strictEqual(storedRow.submission_mode, 'anonymous', 'Should default to anonymous');
    verifyNullContactFields(storedRow, 'Null mode');
    console.log('✅ PASSED\n');

  } catch (err) {
    testError = err;
    console.error(`❌ FAILED: ${err.message}\n`);
  } finally {
    await cleanupTestDb(db, tempTestDir);
    if (testError) throw testError;
  }
});

// Test 3: submission_mode empty string
test('submission_mode empty string: should default to anonymous, contact NULL', async (t) => {
  let { tempTestDir, db } = await setupTestDb('empty');
  let testError = null;

  try {
    console.log('📝 Test 3: submission_mode SET TO empty string ""');
    const repo = createReportRepository(db);

    const reportData = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Test Location',
      description: 'Test description',
      submission_mode: '',
      witness_name: 'Alice Test',
      witness_contact: 'alice@test.com',
      reporter_name: 'Bob Test',
      reporter_contact: 'bob@test.com',
    };

    const inserted = repo.insertReport(reportData);
    
    const directStmt = db.prepare(`
      SELECT submission_mode, witness_name, witness_contact, reporter_name, reporter_contact
      FROM incident_reports
      WHERE id = ?
    `);
    const storedRow = directStmt.get(inserted.id);
    
    console.log(`  Stored submission_mode: ${storedRow.submission_mode}`);
    console.log(`  Stored witness_name: ${storedRow.witness_name}`);
    
    strictEqual(storedRow.submission_mode, 'anonymous', 'Should default to anonymous');
    verifyNullContactFields(storedRow, 'Empty string mode');
    console.log('✅ PASSED\n');

  } catch (err) {
    testError = err;
    console.error(`❌ FAILED: ${err.message}\n`);
  } finally {
    await cleanupTestDb(db, tempTestDir);
    if (testError) throw testError;
  }
});

// Test 4: submission_mode explicitly "anonymous"
test('submission_mode explicitly "anonymous": contact NULL', async (t) => {
  let { tempTestDir, db } = await setupTestDb('explicit');
  let testError = null;

  try {
    console.log('📝 Test 4: submission_mode explicitly "anonymous"');
    const repo = createReportRepository(db);

    const reportData = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Test Location',
      description: 'Test description',
      submission_mode: 'anonymous',
      witness_name: 'Alice Test',
      witness_contact: 'alice@test.com',
      reporter_name: 'Bob Test',
      reporter_contact: 'bob@test.com',
    };

    const inserted = repo.insertReport(reportData);
    
    const directStmt = db.prepare(`
      SELECT submission_mode, witness_name, witness_contact, reporter_name, reporter_contact
      FROM incident_reports
      WHERE id = ?
    `);
    const storedRow = directStmt.get(inserted.id);
    
    console.log(`  Stored submission_mode: ${storedRow.submission_mode}`);
    console.log(`  Stored witness_name: ${storedRow.witness_name}`);
    
    strictEqual(storedRow.submission_mode, 'anonymous');
    verifyNullContactFields(storedRow, 'Explicit anonymous');
    console.log('✅ PASSED\n');

  } catch (err) {
    testError = err;
    console.error(`❌ FAILED: ${err.message}\n`);
  } finally {
    await cleanupTestDb(db, tempTestDir);
    if (testError) throw testError;
  }
});

// Test 5: submission_mode "identified" retains contact
test('submission_mode "identified": contact retained', async (t) => {
  let { tempTestDir, db } = await setupTestDb('identified');
  let testError = null;

  try {
    console.log('📝 Test 5: submission_mode "identified"');
    const repo = createReportRepository(db);

    const reportData = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Test Location',
      description: 'Test description',
      submission_mode: 'identified',
      witness_name: 'Alice Test',
      witness_contact: 'alice@test.com',
      reporter_name: 'Bob Test',
      reporter_contact: 'bob@test.com',
    };

    const inserted = repo.insertReport(reportData);
    
    const directStmt = db.prepare(`
      SELECT submission_mode, witness_name, witness_contact, reporter_name, reporter_contact
      FROM incident_reports
      WHERE id = ?
    `);
    const storedRow = directStmt.get(inserted.id);
    
    console.log(`  Stored submission_mode: ${storedRow.submission_mode}`);
    console.log(`  Stored witness_name: ${storedRow.witness_name}`);
    
    strictEqual(storedRow.submission_mode, 'identified');
    strictEqual(storedRow.witness_name, 'Alice Test', 'Identified: witness_name retained');
    strictEqual(storedRow.witness_contact, 'alice@test.com', 'Identified: witness_contact retained');
    strictEqual(storedRow.reporter_name, 'Bob Test', 'Identified: reporter_name retained');
    strictEqual(storedRow.reporter_contact, 'bob@test.com', 'Identified: reporter_contact retained');
    console.log('✅ PASSED\n');

  } catch (err) {
    testError = err;
    console.error(`❌ FAILED: ${err.message}\n`);
  } finally {
    await cleanupTestDb(db, tempTestDir);
    if (testError) throw testError;
  }
});

// Test 6: unsupported mode rejected
test('unsupported submission_mode rejected', async (t) => {
  let { tempTestDir, db } = await setupTestDb('unsupported');
  let testError = null;

  try {
    console.log('📝 Test 6: submission_mode unsupported value');
    const repo = createReportRepository(db);

    const reportData = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Test Location',
      description: 'Test description',
      submission_mode: 'invalid_mode',
      witness_name: 'Alice Test',
      witness_contact: 'alice@test.com',
      reporter_name: 'Bob Test',
      reporter_contact: 'bob@test.com',
    };

    throws(
      () => repo.insertReport(reportData),
      { message: /unsupported|invalid/ },
      'Should reject unsupported submission_mode'
    );
    console.log('✅ PASSED - Correctly rejected unsupported mode\n');

  } catch (err) {
    testError = err;
    console.error(`❌ FAILED: ${err.message}\n`);
  } finally {
    await cleanupTestDb(db, tempTestDir);
    if (testError) throw testError;
  }
});

// Test 7: input object not mutated
test('input object is not mutated', async (t) => {
  let { tempTestDir, db } = await setupTestDb('mutation');
  let testError = null;

  try {
    console.log('📝 Test 7: input object is not mutated');
    const repo = createReportRepository(db);

    const reportData = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Test Location',
      description: 'Test description',
      submission_mode: null,
      witness_name: 'Alice Original',
      witness_contact: 'alice@original.com',
      reporter_name: 'Bob Original',
      reporter_contact: 'bob@original.com',
    };

    // Keep original values for comparison
    const originalWitness = reportData.witness_name;
    const originalContact = reportData.witness_contact;

    repo.insertReport(reportData);

    // Verify input object was not mutated
    strictEqual(reportData.witness_name, originalWitness, 'Input witness_name should not be mutated');
    strictEqual(reportData.witness_contact, originalContact, 'Input witness_contact should not be mutated');
    strictEqual(reportData.reporter_name, 'Bob Original', 'Input reporter_name should not be mutated');
    strictEqual(reportData.reporter_contact, 'bob@original.com', 'Input reporter_contact should not be mutated');
    console.log('✅ PASSED - Input object not mutated\n');

  } catch (err) {
    testError = err;
    console.error(`❌ FAILED: ${err.message}\n`);
  } finally {
    await cleanupTestDb(db, tempTestDir);
    if (testError) throw testError;
  }
});

console.log('='.repeat(70));
console.log('All submission mode edge case tests completed');
console.log('='.repeat(70) + '\n');
