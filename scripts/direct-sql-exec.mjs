#!/usr/bin/env node
/**
 * Direct SQL Execution via Supabase PostgreSQL
 * Uses HTTP requests to execute administrative SQL
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = "mtholttdmrjptulqcfyk";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aG9sdHRkbXJqcHR1bHFjZnlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI0NTgzOSwiZXhwIjoyMTAwODIxODM5fQ.mcPwk464eCNUi3eJf1Et57Bp06Cw0fqXCcYfxBJQuBY";
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;

console.log(
  "\n╔═══════════════════════════════════════════════════════════════╗",
);
console.log(
  "║   DIRECT SQL EXECUTION - ACCOUNTABILITY WATCH DEPLOYMENT      ║",
);
console.log("║   Project: mtholttdmrjptulqcfyk                              ║");
console.log(
  "╚═══════════════════════════════════════════════════════════════╝\n",
);

// Read SQL file
const sqlPath = path.join(__dirname, "../docs/deployment/FIX_ALL_CRITICAL.sql");
console.log(`📂 Reading: ${sqlPath}`);

if (!fs.existsSync(sqlPath)) {
  console.error(`❌ Not found: ${sqlPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, "utf8");
console.log(`✓ Loaded: ${sqlContent.length} bytes\n`);

// Parse statements
const statements = sqlContent
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--"));

console.log(`📋 SQL Statements: ${statements.length}\n`);

// Safety check
console.log("🔒 Safety Check:");
let isSafe = true;
const dangerous = ["DROP TABLE", "DELETE FROM", "TRUNCATE", "DROP DATABASE"];

for (const danger of dangerous) {
  if (sqlContent.toUpperCase().includes(danger)) {
    console.log(`  ❌ Found: ${danger}`);
    isSafe = false;
  }
}

if (!isSafe) {
  console.error("\n❌ DANGEROUS OPERATIONS DETECTED - ABORTING");
  process.exit(1);
}

console.log("  ✓ No DROP/DELETE/TRUNCATE found");
console.log("  ✓ Safe to execute\n");

// Try to execute via RPC
console.log("⏳ EXECUTING SQL MIGRATION...\n");

let executionStarted = false;

// Combine all SQL into one transaction
const fullSql = `BEGIN;
${statements.join(";\n")};
COMMIT;`;

// Try method 1: Via RPC endpoint (if exists)
executeViaRPC(fullSql);

function executeViaRPC(sql) {
  console.log("Method 1️⃣: Attempting RPC execution...\n");

  const payload = JSON.stringify({ query: sql });

  const options = {
    hostname: `${PROJECT_ID}.supabase.co`,
    port: 443,
    path: "/rest/v1/rpc/execute_sql",
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      "Content-Length": payload.length,
    },
  };

  const req = https.request(options, (res) => {
    let data = "";

    res.on("data", (chunk) => (data += chunk));

    res.on("end", () => {
      if (res.statusCode === 200) {
        console.log("✅ MIGRATION EXECUTED SUCCESSFULLY!\n");
        console.log("Status: 200 OK");
        console.log("Response:", data);
        console.log("\n🎉 All SQL statements applied!\n");
        process.exit(0);
      } else if (res.statusCode === 404) {
        console.log("⚠ RPC not available (404)\n");
        executeViaSQL();
      } else {
        console.log(`⚠ Status: ${res.statusCode}`);
        console.log("Response:", data);
        console.log("\nTrying alternative method...\n");
        executeViaSQL();
      }
    });
  });

  req.on("error", () => {
    console.log("Connection error - trying alternative...\n");
    executeViaSQL();
  });

  req.write(payload);
  req.end();
}

// Method 2: Execute individual statements via table RPC
function executeViaSQL() {
  console.log("Method 2️⃣: Executing via SQL function...\n");

  // Create a temporary function to execute the SQL
  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION execute_migration_sql(sql_text text)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  EXECUTE sql_text;
  RETURN 'Migration executed successfully';
END;
$$ LANGUAGE plpgsql;
`;

  const payload = JSON.stringify({
    query: createFunctionSQL + "\n\nSELECT execute_migration_sql($1);",
    params: [statements.join(";")],
  });

  const options = {
    hostname: `${PROJECT_ID}.supabase.co`,
    port: 443,
    path: "/rest/v1/rpc/sql",
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      "Content-Length": payload.length,
    },
  };

  const req = https.request(options, (res) => {
    let data = "";

    res.on("data", (chunk) => (data += chunk));

    res.on("end", () => {
      if (res.statusCode === 200) {
        console.log("✅ SUCCESS!\n");
        process.exit(0);
      } else {
        console.log(`Status: ${res.statusCode}`);
        console.log("Response:", data);
        console.log("\n");
        manualExecutionInstructions();
      }
    });
  });

  req.on("error", () => {
    manualExecutionInstructions();
  });

  req.write(payload);
  req.end();
}

function manualExecutionInstructions() {
  console.log("\n⚠️  REST API does not support arbitrary SQL execution\n");
  console.log("📝 MANUAL EXECUTION REQUIRED:\n");
  console.log("1. Open: https://app.supabase.com");
  console.log("2. Project: mtholttdmrjptulqcfyk");
  console.log("3. SQL Editor → New Query");
  console.log(
    "4. File: accountability-watch/docs/deployment/FIX_ALL_CRITICAL.sql",
  );
  console.log("5. Click Run\n");
  console.log("✅ Database will be updated with all fixes");
  console.log("✅ Performance indexes created");
  console.log("✅ RLS policies updated");
  console.log("✅ Constraints added\n");
  process.exit(0);
}
