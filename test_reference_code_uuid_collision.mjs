#!/usr/bin/env node
/**
 * Test for UUID-based reference code generation.
 * 
 * This test verifies that when Math.random() and Date.now() both return
 * fixed values, the repository still generates unique reference codes
 * for each report.
 * 
 * This is a deterministic weakness test:
 * - With Math.random() suffix, the weakness is hidden by randomness
 * - By mocking both Date.now() and Math.random(), we expose whether
 *   the repository truly generates unique codes
 * 
 * Tests that:
 * 1. Two reports get different IDs
 * 2. Two reports get different reference codes
 * 3. Both can be read back
 * 4. The weakness test reveals if the current implementation is insufficient
 */

import { test } from 'node:test';
import { strictEqual, notStrictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createReportRepository } from './src/server/report-repository.ts';

console.log('\n' + '='.repeat(70));
console.log('UUID-Based Reference Code Test');
console.log('='.repeat(70) + '\n');

const schema = readFileSync('db/schema.sql', 'utf-8');

test('Two reports with fixed Date.now() and Math.random() have different codes', async (t) => {
  // Save originals
  const originalNow = Date.now;
  const originalRandom = Math.random;
  let testError = null;

  try {
    console.log('📝 Test: Forcing Date.now() and Math.random() collision...');
    
    // Create in-memory database
    console.log('🔌 Creating in-memory database...');
    const db = new DatabaseSync(':memory:');
    db.exec(schema);
    console.log('✓ Schema loaded\n');

    const repo = createReportRepository(db);

    // Mock BOTH Date.now and Math.random to fixed values
    const fixedTimestamp = 1700000000000;
    const fixedRandom = 0.5; // Returns 0.5 for every call
    
    console.log(`⏱ Mocking Date.now() to return: ${fixedTimestamp}`);
    console.log(`🎲 Mocking Math.random() to return: ${fixedRandom}`);
    
    Date.now = () => fixedTimestamp;
    Math.random = () => fixedRandom;
    
    console.log('✓ Both functions mocked\n');

    // Insert first report
    console.log('📝 Inserting first report with mocked functions...');
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

    // Insert second report with SAME mocked functions
    console.log('📝 Inserting second report with SAME mocked functions...');
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

    // Verify they have different IDs
    console.log('🔍 Verifying reports have different IDs...');
    notStrictEqual(
      report1.id,
      report2.id,
      'Reports must have different IDs'
    );
    console.log(`✓ Report 1 ID: ${report1.id}`);
    console.log(`✓ Report 2 ID: ${report2.id}`);
    console.log('✓ IDs are different\n');

    // Verify they have different codes
    console.log('🔍 Verifying reports have different codes...');
    notStrictEqual(
      report1.report_code,
      report2.report_code,
      'Reports created with mocked random/time must have different codes'
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
    // ALWAYS restore both functions, even if test fails
    console.log('🔧 Restoring mocked functions...');
    Date.now = originalNow;
    Math.random = originalRandom;
    console.log('✓ Date.now() restored');
    console.log('✓ Math.random() restored\n');

    if (testError) {
      throw testError;
    }
  }
});
