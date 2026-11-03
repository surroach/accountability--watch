#!/usr/bin/env node
/**
 * Test the server-side SQLite report repository.
 * 
 * Tests:
 * 1. Insert a report with realistic fictional data (including apostrophes)
 * 2. Read the report back and verify all fields
 * 3. Close and reopen the database
 * 4. Read the same report again to verify persistence
 * 5. Verify that missing required fields produce an error
 * 6. Verify that invalid IDs return null gracefully
 * 
 * Uses:
 * - Node's built-in node:sqlite and node:test modules
 * - Actual db/schema.sql
 * - mkdtemp for unique temporary directory
 * - The actual src/server/report-repository.mjs module
 * - Fictional data only
 * 
 * Never opens db/accountability.db.
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
console.log('SQLite Report Repository Test');
console.log('='.repeat(70) + '\n');

test('Report repository: insert, read, and persist fictional reports', async (t) => {
  let tempTestDir = null;
  let db1 = null;
  let db2 = null;
  let testError = null;

  try {
    // Setup: Create unique temporary database
    console.log('📁 Creating unique temporary test directory...');
    const prefix = join(tmpdir(), 'accountability-watch-repo-test-');
    tempTestDir = await mkdtemp(prefix);
    const dbPath = join(tempTestDir, 'test-accountability.db');
    console.log(`✓ Created: ${tempTestDir}\n`);

    // Load schema
    console.log('📄 Reading schema from db/schema.sql...');
    const schema = readFileSync('db/schema.sql', 'utf-8');
    console.log(`✓ Read ${schema.length} bytes of schema\n`);

    // First connection: Initialize schema
    console.log('🔌 First connection: Initialize database...');
    db1 = new DatabaseSync(dbPath);
    console.log('✓ Connected to database');

    console.log('⏳ Executing schema...');
    db1.exec(schema);
    console.log('✓ Schema executed\n');

    // Create repository
    console.log('📦 Creating report repository...');
    const repo = createReportRepository(db1);
    console.log('✓ Repository created\n');

    // Test 1: Insert report with realistic fictional data including apostrophe
    console.log('📝 Test 1: Insert fictional report...');
    const reportData = {
      incident_at: '2026-10-31T15:30:00Z',
      location_text: "Madison's Police Precinct, Main Street",
      city: 'Madison',
      incident_type: 'excessive_force',
      description:
        "Officers didn't follow protocol during arrest. Multiple witness accounts available.",
      injury_details: 'Minor bruises and scratches',
      badge_or_unit: 'Unit 42',
      submission_mode: 'identified',
      urgent_flag: true,
      status: 'pending_moderation',
      consent_given: true,
      witness_name: "Jane O'Connor",
      witness_contact: 'jane@example.com',
    };

    let insertedId = null;
    let insertedReportCode = null;

    try {
      const inserted = repo.insertReport(reportData);
      insertedId = inserted.id;
      insertedReportCode = inserted.report_code;
      console.log(`✓ Report inserted`);
      console.log(`  ID: ${insertedId}`);
      console.log(`  Report Code: ${insertedReportCode}\n`);
    } catch (err) {
      throw new Error(`Insert failed: ${err.message}`);
    }

    // Test 2: Read report back in same connection
    console.log('🔍 Test 2: Read report back (same connection)...');
    let readReport = null;
    try {
      readReport = repo.readReportById(insertedId);
      if (!readReport) {
        throw new Error('Report not found after insert');
      }
      console.log('✓ Report read successfully');
      console.log(`  ID: ${readReport.id}`);
      console.log(`  Code: ${readReport.report_code}`);
      console.log(`  Location: ${readReport.location_text}`);
      console.log(`  Description: ${readReport.description.substring(0, 50)}...`);
      console.log(`  Witness Name: ${readReport.witness_name}\n`);
    } catch (err) {
      throw new Error(`Read failed: ${err.message}`);
    }

    // Verify data integrity (especially apostrophes)
    console.log('✓ Verifying data integrity...');
    strictEqual(
      readReport.location_text,
      "Madison's Police Precinct, Main Street",
      'Location with apostrophe should be preserved'
    );
    strictEqual(
      readReport.description,
      "Officers didn't follow protocol during arrest. Multiple witness accounts available.",
      'Description with apostrophe should be preserved'
    );
    strictEqual(
      readReport.witness_name,
      "Jane O'Connor",
      "Witness name with apostrophe should be preserved"
    );
    strictEqual(readReport.urgent_flag, true, 'urgent_flag should be boolean true');
    strictEqual(readReport.consent_given, true, 'consent_given should be boolean true');
    console.log('✓ All data integrity checks passed\n');

    // Test 3: Close and reopen database
    console.log('🔌 Test 3: Close and reopen database...');
    db1.close();
    db1 = null;
    console.log('✓ First connection closed');

    db2 = new DatabaseSync(dbPath);
    console.log('✓ Second connection opened\n');

    // Test 4: Read report in new connection
    console.log('🔍 Test 4: Read report (new connection)...');
    const repo2 = createReportRepository(db2);
    let readReport2 = null;
    try {
      readReport2 = repo2.readReportById(insertedId);
      if (!readReport2) {
        throw new Error('Report not found after reopen');
      }
      console.log('✓ Report read successfully in new connection');
      console.log(`  ID: ${readReport2.id}`);
      console.log(`  Code: ${readReport2.report_code}\n`);
    } catch (err) {
      throw new Error(`Read in new connection failed: ${err.message}`);
    }

    // Verify persistence
    console.log('✓ Verifying persistence...');
    strictEqual(
      readReport2.id,
      readReport.id,
      'Report ID should be identical after reopen'
    );
    strictEqual(
      readReport2.report_code,
      readReport.report_code,
      'Report code should be identical after reopen'
    );
    strictEqual(
      readReport2.location_text,
      readReport.location_text,
      'Location should be identical after reopen'
    );
    console.log('✓ Persistence verified\n');

    // Test 5: Invalid ID returns null
    console.log('✓ Test 5: Reading invalid ID returns null...');
    const notFound = repo2.readReportById('00000000-0000-0000-0000-000000000000');
    strictEqual(notFound, null, 'Invalid ID should return null');
    console.log('✓ Correctly returned null for invalid ID\n');

    // Test 6: Missing required fields throw error
    console.log('✓ Test 6: Missing required fields throw error...');
    const incompleteData = {
      // Missing incident_at
      location_text: 'Test Location',
      description: 'Test description',
    };
    throws(
      () => repo2.insertReport(incompleteData),
      { message: /incident_at is required/ },
      'Should throw error for missing incident_at'
    );
    console.log('✓ Correctly threw error for missing incident_at\n');

    // Test 7: Missing reportId throws error
    console.log('✓ Test 7: Missing reportId throws error...');
    throws(
      () => repo2.readReportById(null),
      { message: /reportId is required/ },
      'Should throw error for null reportId'
    );
    console.log('✓ Correctly threw error for missing reportId\n');

    console.log('='.repeat(70));
    console.log('✅ ALL REPOSITORY TESTS PASSED');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    testError = err;
    console.error('\n' + '='.repeat(70));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${err.message}\n`);
  } finally {
    console.log('🔧 Cleanup phase:');

    if (db1) {
      try {
        console.log('  Closing connection 1...');
        db1.close();
        db1 = null;
        console.log('  ✓ Connection 1 closed');
      } catch (err) {
        console.error(`  ⚠ Error closing connection 1: ${err.message}`);
      }
    }

    if (db2) {
      try {
        console.log('  Closing connection 2...');
        db2.close();
        db2 = null;
        console.log('  ✓ Connection 2 closed');
      } catch (err) {
        console.error(`  ⚠ Error closing connection 2: ${err.message}`);
      }
    }

    if (tempTestDir) {
      try {
        console.log(`  Removing temporary directory...`);
        await rm(tempTestDir, { recursive: true, force: true });
        console.log('  ✓ Temporary directory removed');
      } catch (cleanupErr) {
        console.error(`  ❌ Error removing temporary directory: ${cleanupErr.message}`);
        console.error(`     Directory path: ${tempTestDir}`);
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
