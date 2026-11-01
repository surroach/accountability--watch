#!/usr/bin/env node
/**
 * Integration test: End-to-end workflow with SQLite persistence
 * 
 * Tests:
 * 1. Submit report → save to SQLite → read back
 * 2. Close and reopen database → confirm data persists
 * 3. Submit multiple reports with files
 * 4. Verify file metadata stored correctly
 */

import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createReportRepository } from './src/server/report-repository.ts';

console.log('\n' + '='.repeat(70));
console.log('Integration Test: SQLite Persistence Workflow');
console.log('='.repeat(70) + '\n');

const schema = readFileSync('db/schema.sql', 'utf-8');

test('Full workflow: Submit report → persist → close → reopen → verify', async (t) => {
  let testDir = null;
  let dbPath = null;
  let db = null;
  let db2 = null;

  try {
    // Setup: Create temporary test directory
    console.log('📁 Creating temporary test directory...');
    testDir = mkdtempSync(join(tmpdir(), 'accountability-watch-test-'));
    dbPath = join(testDir, 'test.db');
    console.log(`✓ Test directory: ${testDir}\n`);

    // ── Phase 1: Create and populate database ──
    console.log('📝 Phase 1: Creating database and submitting reports...\n');
    
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(schema);
    
    const repo = createReportRepository(db);

    // Submit first report (anonymous, no files)
    console.log('  📋 Report 1: Anonymous submission without files');
    const report1Data = {
      incident_at: '2026-10-31T14:00:00Z',
      location_text: 'Central Park, near west gate',
      city: 'New York',
      incident_type: 'excessive_force',
      description: 'Officers used excessive force during protest. Multiple witnesses present.',
      submission_mode: 'anonymous',
      urgent_flag: false,
      consent_given: true,
    };

    const report1 = repo.insertReport(report1Data);
    console.log(`    ✓ Report 1 created: ${report1.report_code}`);
    console.log(`      ID: ${report1.id}`);
    console.log(`      Code: ${report1.report_code}\n`);

    strictEqual(typeof report1.id, 'string', 'Report 1 should have ID');
    strictEqual(typeof report1.report_code, 'string', 'Report 1 should have code');
    ok(report1.report_code.startsWith('RPT-'), 'Report 1 code should start with RPT-');

    // Submit second report (identified, with metadata)
    console.log('  📋 Report 2: Identified submission with contact info');
    const report2Data = {
      incident_at: '2026-10-31T15:30:00Z',
      location_text: 'Downtown courthouse steps',
      city: 'San Francisco',
      incident_type: 'wrongful_arrest',
      description: 'Person arrested without clear charges. Detained for 6 hours.',
      injury_details: 'Minor bruising on left arm',
      badge_or_unit: 'Badge 4521',
      submission_mode: 'identified',
      urgent_flag: true,
      consent_given: true,
      witness_name: 'Jane Smith',
      witness_contact: 'jane@example.com',
      reporter_name: 'John Doe',
      reporter_contact: '+1-555-0123',
    };

    const report2 = repo.insertReport(report2Data);
    console.log(`    ✓ Report 2 created: ${report2.report_code}`);
    console.log(`      ID: ${report2.id}`);
    console.log(`      Code: ${report2.report_code}\n`);

    strictEqual(typeof report2.id, 'string', 'Report 2 should have ID');
    ok(report2.report_code.startsWith('RPT-'), 'Report 2 code should start with RPT-');

    // Verify both codes are different
    ok(
      report1.report_code !== report2.report_code,
      'Report codes should be unique'
    );

    // ── Phase 2: Query reports while database is open ──
    console.log('📖 Phase 2: Reading reports from database...\n');

    const read1 = repo.readReportById(report1.id);
    console.log('  ✓ Report 1 read from database');
    strictEqual(read1.report_code, report1.report_code, 'Report 1 code should match');
    strictEqual(read1.submission_mode, 'anonymous', 'Report 1 should be anonymous');
    strictEqual(read1.witness_name, null, 'Report 1 should not have witness name');
    strictEqual(read1.reporter_name, null, 'Report 1 should not have reporter name');

    const read2 = repo.readReportById(report2.id);
    console.log('  ✓ Report 2 read from database');
    strictEqual(read2.report_code, report2.report_code, 'Report 2 code should match');
    strictEqual(read2.submission_mode, 'identified', 'Report 2 should be identified');
    strictEqual(read2.witness_name, 'Jane Smith', 'Report 2 should have witness name');
    strictEqual(read2.reporter_contact, '+1-555-0123', 'Report 2 should have reporter contact');
    strictEqual(read2.urgent_flag, true, 'Report 2 should be marked urgent');
    console.log();

    // ── Phase 3: Close database ──
    console.log('🔒 Phase 3: Closing database...');
    db.close();
    console.log('  ✓ Database closed\n');

    // ── Phase 4: Reopen database ──
    console.log('🔓 Phase 4: Reopening database...');
    db2 = new DatabaseSync(dbPath);
    db2.exec('PRAGMA foreign_keys = ON;');
    const repo2 = createReportRepository(db2);
    console.log('  ✓ Database reopened\n');

    // ── Phase 5: Verify persistence ──
    console.log('✅ Phase 5: Verifying persistence after restart...\n');

    const persist1 = repo2.readReportById(report1.id);
    console.log('  ✓ Report 1 persisted');
    strictEqual(persist1.id, report1.id, 'Report 1 ID should persist');
    strictEqual(persist1.report_code, report1.report_code, 'Report 1 code should persist');
    strictEqual(
      persist1.description,
      'Officers used excessive force during protest. Multiple witnesses present.',
      'Report 1 description should persist'
    );

    const persist2 = repo2.readReportById(report2.id);
    console.log('  ✓ Report 2 persisted');
    strictEqual(persist2.id, report2.id, 'Report 2 ID should persist');
    strictEqual(persist2.report_code, report2.report_code, 'Report 2 code should persist');
    strictEqual(persist2.witness_name, 'Jane Smith', 'Report 2 witness name should persist');
    strictEqual(
      persist2.reporter_contact,
      '+1-555-0123',
      'Report 2 reporter contact should persist'
    );

    // Query all reports
    console.log('  ✓ Querying all reports...');
    const allStmt = db2.prepare('SELECT COUNT(*) as cnt FROM incident_reports');
    const count = allStmt.get();
    strictEqual(count.cnt, 2, 'Should have exactly 2 reports');
    console.log(`    Found ${count.cnt} reports\n`);

    // ── Phase 6: Add evidence metadata ──
    console.log('📎 Phase 6: Testing evidence metadata...\n');

    const evidenceStmt = db2.prepare(`
      INSERT INTO report_evidence (
        id, report_id, storage_path, file_name, content_type,
        size_bytes, sha256, gps_latitude, gps_longitude,
        gps_accuracy_meters, media_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const { randomUUID } = await import('node:crypto');
    const now = new Date().toISOString();

    const evId = randomUUID();
    evidenceStmt.run(
      evId,
      report2.id,
      'test-id/1234567890_photo.jpg',
      'photo.jpg',
      'image/jpeg',
      1024 * 500, // 500KB
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      40.7128,
      -74.0060,
      15.0,
      '2026-10-31T15:30:00Z',
      now,
      now
    );

    console.log('  ✓ Evidence record inserted');

    // Read evidence back
    const evStmt = db2.prepare('SELECT * FROM report_evidence WHERE report_id = ?');
    const evs = evStmt.all(report2.id);
    strictEqual(evs.length, 1, 'Should have 1 evidence record');
    strictEqual(evs[0].file_name, 'photo.jpg', 'Evidence file name should match');
    strictEqual(evs[0].size_bytes, 512000, 'Evidence size should match');
    strictEqual(evs[0].gps_latitude, 40.7128, 'Evidence GPS should match');
    console.log('  ✓ Evidence metadata verified\n');

    console.log('='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(70));
    console.log(`
Summary:
  ✓ Report submission → SQLite save
  ✓ Read reports back from database
  ✓ Database close/reopen
  ✓ Data persists after restart
  ✓ Anonymous privacy preserved (no contact fields)
  ✓ Identified reports preserve contact details
  ✓ Evidence metadata stored and queried
  ✓ Unique reference codes generated
  ✓ Urgent flag persisted
\n`);

  } catch (err) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${err.message}\n`);
    console.error(err.stack);
    throw err;
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    if (db) try { db.close(); } catch (e) {}
    if (db2) try { db2.close(); } catch (e) {}
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
      console.log(`  ✓ Test directory cleaned\n`);
    }
  }
});
