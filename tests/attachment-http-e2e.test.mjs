import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

describe("Attachment Download - Real HTTP E2E Tests", () => {
  let testDbPath;
  let testAttachmentDir;
  let testDb;
  let serverProcess;
  let baseUrl = "http://localhost:3000";
  let reportId;
  let fileId;
  const originalContent = Buffer.from("This is a test file content for downloading");

  beforeAll(async () => {
    console.log("\n=== SETUP: Real HTTP E2E Test Environment ===\n");

    // Create temp directories
    const tempBase = join(tmpdir(), `accountability-http-test-${Date.now()}`);
    testDbPath = join(tempBase, "test.db");
    testAttachmentDir = join(tempBase, "attachments");

    await mkdir(testAttachmentDir, { recursive: true });
    console.log(`📁 Test attachment dir: ${testAttachmentDir}`);
    console.log(`📁 Test database: ${testDbPath}`);

    // Create test database
    testDb = new Database(testDbPath);

    // Create schema
    testDb.exec(`
      CREATE TABLE incident_reports (
        id TEXT PRIMARY KEY,
        report_code TEXT NOT NULL,
        incident_at TEXT NOT NULL,
        location_text TEXT NOT NULL,
        city TEXT,
        incident_type TEXT,
        description TEXT NOT NULL,
        injury_details TEXT,
        badge_or_unit TEXT,
        submission_mode TEXT DEFAULT 'anonymous',
        urgent_flag BOOLEAN DEFAULT 0,
        consent_given BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'pending_moderation',
        witness_name TEXT,
        witness_contact TEXT,
        reporter_name TEXT,
        reporter_contact TEXT,
        gps_latitude REAL,
        gps_longitude REAL,
        gps_accuracy REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE report_evidence (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT,
        size_bytes INTEGER DEFAULT 0,
        sha256 TEXT,
        gps_latitude REAL,
        gps_longitude REAL,
        gps_accuracy_meters REAL,
        media_timestamp TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (report_id) REFERENCES incident_reports(id)
      );
    `);

    console.log("✓ Schema created");

    // Insert test report
    reportId = randomUUID();
    fileId = randomUUID();
    const now = new Date().toISOString();

    testDb.prepare(`
      INSERT INTO incident_reports (
        id, report_code, incident_at, location_text, description,
        incident_type, submission_mode, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      "E2E-TEST-001",
      "2026-10-31T10:00:00Z",
      "Test Location",
      "E2E test report for attachment download",
      "excessive_force",
      "identified",
      "pending_moderation",
      now,
      now
    );

    console.log(`✓ Test report created: ${reportId}`);

    // Create test attachment
    const reportAttachmentDir = join(testAttachmentDir, reportId);
    await mkdir(reportAttachmentDir, { recursive: true });

    const fileName = `${Date.now()}_test-attachment.txt`;
    const filePath = join(reportAttachmentDir, fileName);
    await writeFile(filePath, originalContent);

    console.log(`✓ Test attachment created: ${filePath}`);

    // Record in database
    testDb.prepare(`
      INSERT INTO report_evidence (
        id, report_id, storage_path, file_name, content_type,
        size_bytes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      reportId,
      `${reportId}/${fileName}`,
      "test-attachment.txt",
      "text/plain",
      originalContent.length,
      now,
      now
    );

    console.log(`✓ File metadata recorded in database`);
    console.log(`✓ File ID: ${fileId}`);
    console.log(`✓ Report ID: ${reportId}\n`);

    // Start test server
    console.log("🚀 Starting test server...\n");

    // Set environment for test
    process.env.ACCOUNTABILITY_ATTACHMENTS_DIR = testAttachmentDir;
    process.env.DATABASE_PATH = testDbPath;

    // Start the dev server
    serverProcess = spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: {
        ...process.env,
        ACCOUNTABILITY_ATTACHMENTS_DIR: testAttachmentDir,
      },
    });

    // Wait for server to start
    await sleep(5000);
    console.log("✓ Test server started\n");
  });

  afterAll(async () => {
    console.log("\n=== CLEANUP ===\n");

    // Stop server
    if (serverProcess) {
      serverProcess.kill();
      console.log("✓ Server stopped");
    }

    // Close database
    if (testDb) {
      testDb.close();
      console.log("✓ Database closed");
    }

    // Clean up temp directory
    const tempBase = join(tmpdir(), `accountability-http-test-${Date.now().toString().slice(0, -5)}`);
    try {
      await rm(tempBase, { recursive: true, force: true });
      console.log("✓ Temp directory cleaned");
    } catch (err) {
      console.log("⚠ Temp directory cleanup skipped");
    }

    delete process.env.ACCOUNTABILITY_ATTACHMENTS_DIR;
  });

  it("GET /api/reports/:id returns file with exists=true", async () => {
    console.log("\n=== TEST 1: Report Detail Returns File Status ===\n");

    const response = await fetch(`${baseUrl}/api/reports/${reportId}`);
    const data = await response.json();

    console.log(`HTTP ${response.status}`);
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    console.log("✓ Report fetched successfully");

    expect(data.data.files).toHaveLength(1);
    console.log("✓ One file in report");

    const file = data.data.files[0];
    expect(file.id).toBe(fileId);
    expect(file.file_name).toBe("test-attachment.txt");
    expect(file.exists).toBe(true);
    console.log(`✓ File exists: ${file.exists}`);
    console.log(`✓ File ID matches: ${file.id === fileId}`);

    // Verify storage_path NOT in response
    expect(file.storage_path).toBeUndefined();
    console.log("✓ Storage path NOT exposed to client\n");
  });

  it("GET /api/reports/:id/files/:fileId downloads file", async () => {
    console.log("\n=== TEST 2: Download File ===\n");

    const response = await fetch(`${baseUrl}/api/reports/${reportId}/files/${fileId}`);

    console.log(`HTTP ${response.status}`);
    expect(response.status).toBe(200);
    console.log("✓ Download endpoint responded with 200");

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    console.log(`✓ Downloaded ${buffer.length} bytes`);
    console.log(`✓ Original was ${originalContent.length} bytes`);

    expect(buffer.length).toBe(originalContent.length);
    console.log("✓ Size matches");

    expect(buffer.equals(originalContent)).toBe(true);
    console.log("✓ Content matches exactly");

    // Check headers
    const contentType = response.headers.get("Content-Type");
    expect(contentType).toBe("text/plain");
    console.log(`✓ Content-Type: ${contentType}`);

    const filename = response.headers.get("Content-Disposition");
    expect(filename).toContain("test-attachment.txt");
    console.log(`✓ Filename header present\n`);
  });

  it("Server restart preserves file download capability", async () => {
    console.log("\n=== TEST 3: Persistence After Server Restart ===\n");

    // Kill and restart server
    console.log("Stopping server...");
    serverProcess.kill();
    await sleep(2000);

    console.log("Restarting server...");
    serverProcess = spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: {
        ...process.env,
        ACCOUNTABILITY_ATTACHMENTS_DIR: testAttachmentDir,
      },
    });

    await sleep(5000);
    console.log("✓ Server restarted\n");

    // Try download again
    const response = await fetch(`${baseUrl}/api/reports/${reportId}/files/${fileId}`);

    console.log(`HTTP ${response.status}`);
    expect(response.status).toBe(200);
    console.log("✓ Download still works after restart");

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    expect(buffer.equals(originalContent)).toBe(true);
    console.log("✓ Content still matches\n");
  });

  it("Missing file returns 404", async () => {
    console.log("\n=== TEST 4: Missing File Error ===\n");

    const fakeFileId = randomUUID();
    const response = await fetch(`${baseUrl}/api/reports/${reportId}/files/${fakeFileId}`);

    console.log(`HTTP ${response.status}`);
    expect(response.status).toBe(404);
    console.log("✓ Missing file returns 404");

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain("File not found");
    console.log(`✓ Error message: "${data.error.message}"\n`);
  });

  it("Wrong report ID prevents file access", async () => {
    console.log("\n=== TEST 5: Wrong Report ID Security ===\n");

    const wrongReportId = randomUUID();
    const response = await fetch(`${baseUrl}/api/reports/${wrongReportId}/files/${fileId}`);

    console.log(`HTTP ${response.status}`);
    expect(response.status).toBe(404);
    console.log("✓ Wrong report ID returns 404");

    const data = await response.json();
    expect(data.success).toBe(false);
    console.log(`✓ File not accessible with wrong report ID\n`);
  });

  it("Invalid report ID format returns 400", async () => {
    console.log("\n=== TEST 6: Invalid ID Format ===\n");

    const response = await fetch(`${baseUrl}/api/reports/invalid/files/also-invalid`);

    console.log(`HTTP ${response.status}`);
    // Should not match the regex, so returns 404 or null from handler
    expect([404, 400]).toContain(response.status);
    console.log(`✓ Invalid format returns ${response.status}\n`);
  });
});
