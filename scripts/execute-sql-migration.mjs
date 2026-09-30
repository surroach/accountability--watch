#!/usr/bin/env node
/**
 * Execute SQL Migration via Supabase PostgreSQL Connection
 * Uses the data API with SQL endpoint
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_PROJECT_ID = "mtholttdmrjptulqcfyk";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aG9sdHRkbXJqcHR1bHFjZnlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI0NTgzOSwiZXhwIjoyMTAwODIxODM5fQ.mcPwk464eCNUi3eJf1Et57Bp06Cw0fqXCcYfxBJQuBY";

console.log("╔═════════════════════════════════════════════════════════════╗");
console.log("║       SQL MIGRATION EXECUTION VIA SUPABASE API              ║");
console.log("║       Project: mtholttdmrjptulqcfyk                         ║");
console.log(
  "╚═════════════════════════════════════════════════════════════╝\n",
);

// Read SQL file
const sqlPath = path.join(__dirname, "../docs/deployment/FIX_ALL_CRITICAL.sql");
console.log(`📂 Reading SQL file: ${sqlPath}`);

if (!fs.existsSync(sqlPath)) {
  console.error(`❌ File not found: ${sqlPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, "utf8");
console.log(`✓ Loaded ${sqlContent.length} bytes\n`);

// Parse statements
const statements = sqlContent
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--"));

console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

// Create combined SQL (remove BEGIN/COMMIT since REST API doesn't support them)
let combinedSql = statements
  .filter(
    (stmt) =>
      !stmt.toUpperCase().includes("BEGIN") &&
      !stmt.toUpperCase().includes("COMMIT"),
  )
  .join("; ");

console.log("🔍 Safety check:");
if (
  combinedSql.toUpperCase().includes("DROP TABLE") ||
  combinedSql.toUpperCase().includes("DELETE FROM") ||
  combinedSql.toUpperCase().includes("TRUNCATE")
) {
  console.error("❌ DANGEROUS OPERATIONS DETECTED - Aborting!");
  process.exit(1);
}
console.log("✓ Safety check passed\n");

console.log("⚙ Operations to apply:");
if (sqlContent.includes("DROP POLICY"))
  console.log("  • Drop restrictive RLS policies");
if (sqlContent.includes("CREATE POLICY"))
  console.log("  • Create permissive RLS policies");
if (sqlContent.includes("CREATE INDEX"))
  console.log("  • Create performance indexes");
if (sqlContent.includes("ADD CONSTRAINT"))
  console.log("  • Add data validation constraints");
if (sqlContent.includes("GRANT")) console.log("  • Grant permissions to roles");
console.log("\n⏳ Executing via Supabase REST API...\n");

// Make request via REST API
const data = JSON.stringify({
  sql: combinedSql,
});

const options = {
  hostname: `${SUPABASE_PROJECT_ID}.supabase.co`,
  port: 443,
  path: "/rest/v1/rpc/exec_sql",
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    apikey: SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

const req = https.request(options, (res) => {
  let responseData = "";

  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    console.log(`Status Code: ${res.statusCode}`);

    if (res.statusCode === 404) {
      console.log("\n⚠ Note: exec_sql RPC function not available via REST API");
      console.log(
        "This is expected - SQL must be executed via Supabase dashboard or direct connection",
      );
      console.log("\nAlternative: Execute directly in Supabase SQL Editor:");
      console.log("1. Go to https://app.supabase.com");
      console.log("2. Select project: mtholttdmrjptulqcfyk");
      console.log("3. Click SQL Editor → New Query");
      console.log("4. Paste docs/deployment/FIX_ALL_CRITICAL.sql");
      console.log("5. Click Run\n");
      process.exit(0);
    }

    try {
      const result = JSON.parse(responseData);
      console.log("Response:", JSON.stringify(result, null, 2));
    } catch (e) {
      console.log("Response:", responseData);
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log("\n✅ SQL migration completed successfully!\n");
      process.exit(0);
    } else {
      console.log("\n❌ SQL migration failed\n");
      process.exit(1);
    }
  });
});

req.on("error", (error) => {
  console.error("Request error:", error);
  process.exit(1);
});

req.write(data);
req.end();
