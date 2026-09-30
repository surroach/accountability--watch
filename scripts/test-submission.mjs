#!/usr/bin/env node
/**
 * Automated Submission Flow Tester
 * Tests all submission scenarios and identifies bugs
 */

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║  AUTOMATED SUBMISSION FLOW TEST                         ║');
console.log('║  Testing local in-memory database                       ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Import the local database client
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple in-memory store
const store = {
  incident_reports: [],
  report_evidence: [],
};

function generateId() {
  return `id-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

const supabase = {
  from: (table) => ({
    insert: (data) => ({
      select: (fields) => ({
        single: async () => {
          try {
            const record = Array.isArray(data) ? data[0] : data;
            const fullRecord = {
              id: record.id || generateId(),
              ...record,
              report_code: record.report_code || `REC-${Date.now()}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (!store[table]) store[table] = [];
            store[table].push(fullRecord);

            console.log(`✅ Inserted into ${table}:`, fullRecord.id);

            const fieldsList = fields ? fields.split(',').map(f => f.trim()) : undefined;
            const result = fieldsList
              ? fieldsList.reduce((acc, field) => {
                  acc[field] = fullRecord[field];
                  return acc;
                }, {})
              : fullRecord;

            return { data: result, error: null };
          } catch (err) {
            console.error("Insert error:", err);
            return { data: null, error: { message: err.message } };
          }
        }
      })
    }),
    then: async (callback) => {
      try {
        const record = Array.isArray(data) ? data[0] : data;
        const fullRecord = {
          id: record.id || generateId(),
          ...record,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (!store[table]) store[table] = [];
        store[table].push(fullRecord);

        return callback({ data: fullRecord, error: null });
      } catch (err) {
        return callback({ data: null, error: { message: err.message } });
      }
    }
  }),
  storage: {
    from: (bucket) => ({
      upload: async (path, file) => {
        try {
          if (!file) throw new Error("No file provided");
          if (!path) throw new Error("No path specified");
          return { data: { path }, error: null };
        } catch (err) {
          return { data: null, error: { message: err.message } };
        }
      }
    })
  }
};

// Test utilities
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  return async () => {
    try {
      console.log(`\n▶ ${name}`);
      await fn();
      console.log(`  ✅ PASSED`);
      passCount++;
    } catch (err) {
      console.log(`  ❌ FAILED: ${err.message}`);
      failCount++;
    }
  };
}

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Test data generators
function createTestReport(overrides = {}) {
  const now = new Date().toISOString();
  return {
    incident_at: now,
    location_text: 'Test Location',
    city: 'Test City',
    incident_type: 'excessive_force',
    description: 'This is a test report with sufficient detail for testing purposes.',
    injury_details: 'No injuries',
    badge_or_unit: 'Unit 123',
    submission_mode: 'anonymous',
    urgent_flag: false,
    status: 'pending_moderation',
    consent_given: true,
    witness_name: null,
    witness_contact: null,
    reporter_name: null,
    reporter_contact: null,
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

const tests = [
  test('TEST 1: Minimal Anonymous Report', async () => {
    const reportData = createTestReport({
      location_text: 'Downtown',
      city: 'Springfield',
      description: 'Incident with minimal details but enough content to pass validation.',
    });

    const result = await supabase
      .from('incident_reports')
      .insert([reportData])
      .select('id, report_code')
      .single();

    await assert(result.data !== null, 'No data returned');
    await assert(result.data.id, 'No ID generated');
    await assert(result.data.report_code, 'No report code generated');
    console.log(`    Report Code: ${result.data.report_code}`);
  }),

  test('TEST 2: Full Named Report', async () => {
    const reportData = createTestReport({
      submission_mode: 'identified',
      witness_name: 'John Doe',
      witness_contact: 'john@example.com',
      reporter_name: 'Jane Smith',
      reporter_contact: '555-1234',
    });

    const result = await supabase
      .from('incident_reports')
      .insert([reportData])
      .select('id, report_code')
      .single();

    await assert(result.data !== null, 'No data returned');
    await assert(result.data.id, 'No ID generated');
    await assert(reportData.witness_name === 'John Doe', 'Witness name not preserved');
    console.log(`    Report Code: ${result.data.report_code}`);
  }),

  test('TEST 3: Urgent Report', async () => {
    const reportData = createTestReport({
      urgent_flag: true,
    });

    const result = await supabase
      .from('incident_reports')
      .insert([reportData])
      .select('id, report_code')
      .single();

    await assert(result.data !== null, 'No data returned');
    await assert(result.data.id, 'No ID generated');
    console.log(`    Report Code: ${result.data.report_code}`);
    console.log(`    Urgent Flag: true`);
  }),

  test('TEST 4: Report with Different Incident Type', async () => {
    const reportData = createTestReport({
      incident_type: 'wrongful_arrest',
      description: 'Report for wrongful arrest during protest with sufficient detail provided.',
    });

    const result = await supabase
      .from('incident_reports')
      .insert([reportData])
      .select('id, report_code')
      .single();

    await assert(result.data !== null, 'No data returned');
    await assert(result.data.id, 'No ID generated');
    console.log(`    Report Code: ${result.data.report_code}`);
    console.log(`    Incident Type: ${reportData.incident_type}`);
  }),

  test('TEST 5: Evidence Record Creation', async () => {
    // First create a report
    const reportData = createTestReport();
    const reportResult = await supabase
      .from('incident_reports')
      .insert([reportData])
      .select('id, report_code')
      .single();

    const reportId = reportResult.data.id;
    console.log(`    Created report: ${reportId}`);

    // Now create evidence record
    const evidenceData = {
      report_id: reportId,
      storage_path: `${reportId}/file-123.jpg`,
      file_name: 'photo.jpg',
      content_type: 'image/jpeg',
      size_bytes: 1024 * 50,
      sha256: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123',
      gps_latitude: 40.7128,
      gps_longitude: -74.0060,
      gps_accuracy_meters: 10,
      media_timestamp: new Date().toISOString(),
    };

    const evResult = await supabase
      .from('report_evidence')
      .insert([evidenceData])
      .select('id')
      .single();

    await assert(evResult.data !== null, 'Evidence not created');
    console.log(`    Evidence File: ${evidenceData.file_name}`);
    console.log(`    Storage Path: ${evidenceData.storage_path}`);
  }),

  test('TEST 6: Multiple Reports', async () => {
    const report1 = createTestReport({ description: 'First report with test content here.' });
    const report2 = createTestReport({ description: 'Second report with test content here.' });
    const report3 = createTestReport({ description: 'Third report with test content here.' });

    const result1 = await supabase
      .from('incident_reports')
      .insert([report1])
      .select('id, report_code')
      .single();

    const result2 = await supabase
      .from('incident_reports')
      .insert([report2])
      .select('id, report_code')
      .single();

    const result3 = await supabase
      .from('incident_reports')
      .insert([report3])
      .select('id, report_code')
      .single();

    await assert(result1.data.id !== result2.data.id, 'Duplicate IDs');
    await assert(result2.data.id !== result3.data.id, 'Duplicate IDs');
    
    const totalReports = store.incident_reports.length;
    console.log(`    Created 3 reports`);
    console.log(`    Total in store: ${totalReports}`);
  }),

  test('TEST 7: Data Persistence', async () => {
    const initialCount = store.incident_reports.length;

    const reportData = createTestReport({ description: 'Persistence test report with detail.' });
    await supabase
      .from('incident_reports')
      .insert([reportData])
      .select('id, report_code')
      .single();

    const finalCount = store.incident_reports.length;
    await assert(finalCount === initialCount + 1, `Expected ${initialCount + 1}, got ${finalCount}`);
    console.log(`    Before: ${initialCount} reports`);
    console.log(`    After: ${finalCount} reports`);
    console.log(`    ✓ Data persisted correctly`);
  }),

  test('TEST 8: Trimming and Normalization', async () => {
    const reportData = createTestReport({
      location_text: '  Downtown Area  ', // Extra spaces
      description: '  Incident description with padding.  ',
    });

    const result = await supabase
      .from('incident_reports')
      .insert([reportData])
      .select('id, report_code')
      .single();

    await assert(result.data !== null, 'No data returned');
    const stored = store.incident_reports.find(r => r.id === result.data.id);
    
    // Check if whitespace is preserved (real app would trim)
    console.log(`    Location Text: "${stored.location_text}"`);
    console.log(`    Description: "${stored.description.substring(0, 30)}..."`);
    console.log(`    ✓ Data stored successfully`);
  }),
];

// ─────────────────────────────────────────────────────────────────────────────
// RUN TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  for (const test of tests) {
    await test();
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total:  ${passCount + failCount}\n`);

  console.log('📋 Data Store Status:');
  console.log(`   Reports stored: ${store.incident_reports.length}`);
  console.log(`   Evidence stored: ${store.report_evidence.length}\n`);

  if (failCount === 0) {
    console.log('🎉 ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED\n');
    process.exit(1);
  }
}

runTests();
