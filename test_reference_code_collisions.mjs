#!/usr/bin/env node
/**
 * Test for reference code collisions in the repository.
 * 
 * Currently, the repository generates report codes using:
 *   reportCode = `RPT-${Date.now()}`
 * 
 * This can cause collisions if two reports are created during the same millisecond.
 * SQLite enforces uniqueness on report_code, so the second insert fails.
 * 
 * This test:
 * 1. Mocks Date.now() to return the same value for two consecutive inserts
 * 2. Attempts to insert both reports
 * 3. Verifies both succeed with different report codes
 * 4. Restores Date.now() even if the test fails
 * 5. Verifies both records can be read back
 */

import { test } from 'node:test';
import { strictEqual, ok, notStrictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createReportRepository } from './src/server/report-repository.ts';

console.log('\n' + '='.repeat(70));
console.log('Reference Code Collision Test');
console.log('='.repeat(70) + '\n');

const schema = readFileSync('db/schema.sql', 'utf-8');

test('Two reports with same Date.now() should have different codes', async (t) => {
  // Save original Date.now
  const originalNow = Date.now;
  let testError = null;

  try {
    console.log('📝 Test: Forcing Date.now() collision...');
    
    // Create in-memory database
    console.log('🔌 Creating in-memory database...');
    const db = new DatabaseSync(':memory:');
    db.exec(schema);
    console.log('✓ Schema loaded\n');

    const repo = createReportRepository(db);

    // Mock Date.now to return fixed value
    const fixedTimestamp = 1700000000000;
    console.log(`⏱ Mocking Date.now() to return: ${fixedTimestamp}`);
    Date.now = () => fixedTimestamp;
    console.log('✓ Date.now() mocked\n');

    // Insert first report
    console.log('📝 Inserting first report with mocked time...');
    const report1Data = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Location 1',
      description: 'First report',
      submission_mode: 'anonymous',
    };

    let report1;
    try {
      report1 = repo.insertReport(report1Data);
      console.log(`✓ First report inserted`);
      console.log(`  ID: ${report1.id}`);
      console.log(`  Code: ${report1.report_code}\n`);
    } catch (err) {
      throw new Error(`First insert failed: ${err.message}`);
    }

    // Insert second report with SAME mocked time
    console.log('📝 Inserting second report with SAME mocked time...');
    const report2Data = {
      incident_at: '2026-10-31T15:00:00Z',
      location_text: 'Location 2',
      description: 'Second report',
      submission_mode: 'identified',
      witness_name: 'Witness Name',
      witness_contact: 'witness@example.com',
    };

    let report2;
    try {
      report2 = repo.insertReport(report2Data);
      console.log(`✓ Second report inserted`);
      console.log(`  ID: ${report2.id}`);
      console.log(`  Code: ${report2.report_code}\n`);
    } catch (err) {
      throw new Error(`Second insert failed: ${err.message}`);
    }

    // Verify they have different codes
    console.log('🔍 Verifying reports have different codes...');
    notStrictEqual(
      report1.report_code,
      report2.report_code,
      'Reports created with same timestamp must have different codes'
    );
    console.log(`✓ Report 1 code: ${report1.report_code}`);
    console.log(`✓ Report 2 code: ${report2.report_code}`);
    console.log('✓ Codes are different\n');

    // Verify both records can be read back
    console.log('🔍 Verifying both records can be read back...');
    const read1 = repo.readReportById(report1.id);
    const read2 = repo.readReportById(report2.id);

    strictEqual(read1.id, report1.id, 'Report 1 should be readable');
    strictEqual(read1.report_code, report1.report_code, 'Report 1 code should match');
    console.log(`✓ Report 1 read: ${read1.report_code}`);

    strictEqual(read2.id, report2.id, 'Report 2 should be readable');
    strictEqual(read2.report_code, report2.report_code, 'Report 2 code should match');
    console.log(`✓ Report 2 read: ${read2.report_code}\n`);

    // Close database
    db.close();

    console.log('='.repeat(70));
    console.log('✅ TEST PASSED');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    testError = err;
    console.error('\n' + '='.repeat(70));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${err.message}\n`);
  } finally {
    // ALWAYS restore Date.now, even if test fails
    console.log('🔧 Restoring Date.now()...');
    Date.now = originalNow;
    console.log('✓ Date.now() restored\n');

    if (testError) {
      throw testError;
    }
  }
});
