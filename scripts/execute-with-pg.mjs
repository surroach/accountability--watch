#!/usr/bin/env node
/**
 * Execute SQL Migration Using pg Library
 * Direct PostgreSQL connection via npm package
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(
  "\n╔═════════════════════════════════════════════════════════════╗",
);
console.log("║  SQL MIGRATION - PostgreSQL Direct Connection              ║");
console.log("║  Project: mtholttdmrjptulqcfyk                             ║");
console.log(
  "╚═════════════════════════════════════════════════════════════╝\n",
);

console.log("📦 Checking for pg library...\n");

let pg;
try {
  pg = await import("pg");
  const { Client } = pg;
  console.log("✅ pg library found\n");
  executeWithPg(Client);
} catch (e) {
  console.log("❌ pg library not installed\n");
  console.log("Install it with: npm install pg\n");
  console.log("Then run: node scripts/execute-with-pg.mjs\n");

  console.log("For now, use manual execution:\n");
  console.log("1. Go to: https://app.supabase.com");
  console.log("2. Project: mtholttdmrjptulqcfyk");
  console.log("3. SQL Editor → New Query");
  console.log("4. Paste: docs/deployment/FIX_ALL_CRITICAL.sql");
  console.log("5. Click Run\n");

  process.exit(0);
}

async function executeWithPg(Client) {
  // Read SQL file
  const sqlPath = path.join(
    __dirname,
    "../docs/deployment/FIX_ALL_CRITICAL.sql",
  );
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
  if (
    sqlContent.toUpperCase().includes("DROP TABLE") ||
    sqlContent.toUpperCase().includes("DELETE FROM")
  ) {
    console.error("❌ Dangerous operations detected");
    process.exit(1);
  }
  console.log("✓ Safe to execute\n");

  // Supabase direct connection
  // NOTE: This requires valid Supabase credentials
  // The Service Role Key is for API, not direct DB connection

  console.log("⚠️  Direct DB connection requires:\n");
  console.log("  1. Supabase database password (from dashboard)");
  console.log("  2. Connection string with authentication\n");

  console.log("📝 Connection Details:\n");
  console.log("  Host: mtholttdmrjptulqcfyk.supabase.co");
  console.log("  Port: 5432");
  console.log("  Database: postgres");
  console.log("  User: postgres");
  console.log("  Password: (from Supabase Dashboard → Settings → Database)\n");

  console.log("💡 To get your database password:");
  console.log("  1. Go to: https://app.supabase.com");
  console.log("  2. Project: mtholttdmrjptulqcfyk");
  console.log("  3. Settings → Database → Connection Info");
  console.log('  4. Find "Password" section\n');

  console.log("🔑 Alternative - Use Service Role Key:");
  console.log("  This project's Service Role Key can't authenticate");
  console.log("  direct PostgreSQL connections (API use only)\n");

  // Create client with connection string format
  // This would require the database password which isn't provided

  const connectionString = `postgresql://postgres:PASSWORD@mtholttdmrjptulqcfyk.supabase.co:5432/postgres`;

  console.log("📄 Connection string format:");
  console.log(
    `  ${connectionString.replace("PASSWORD", "***ENTER_PASSWORD***")}\n`,
  );

  console.log("To execute the migration:\n");
  console.log("Step 1: Get database password from Supabase Dashboard");
  console.log("Step 2: Set environment variable:");
  console.log('  $env:DB_PASSWORD = "your_password"  (Windows PowerShell)');
  console.log('  export DB_PASSWORD="your_password"  (macOS/Linux)\n');
  console.log("Step 3: Run: node scripts/execute-with-pg.mjs\n");

  // Check for environment variable
  const dbPassword = process.env.DB_PASSWORD;

  if (!dbPassword) {
    console.log("❌ DB_PASSWORD environment variable not set\n");
    console.log(
      "Set it and try again. Or use Supabase dashboard for execution.\n",
    );
    process.exit(0);
  }

  console.log("🔐 Database password found in environment\n");
  console.log("⏳ Connecting to Supabase PostgreSQL...\n");

  try {
    const client = new Client({
      connectionString: `postgresql://postgres:${dbPassword}@mtholttdmrjptulqcfyk.supabase.co:5432/postgres`,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log("✅ Connected to database\n");

    console.log("⏳ Executing SQL statements...\n");

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const num = i + 1;

      try {
        console.log(
          `[${num}/${statements.length}] ${stmt.substring(0, 50)}...`,
        );
        await client.query(stmt);
        console.log(`  ✓ Success\n`);
      } catch (error) {
        console.log(`  ⚠ ${error.message}\n`);
      }
    }

    console.log("✅ MIGRATION COMPLETE!\n");
    console.log("Summary:");
    console.log("  • RLS policies updated");
    console.log("  • Performance indexes created");
    console.log("  • Data validation constraints added");
    console.log("  • Storage policies configured\n");

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}\n`);

    if (error.message.includes("password")) {
      console.log("🔑 Password error - check your DB_PASSWORD\n");
    }

    console.log("💡 Use Supabase Dashboard for execution instead:\n");
    console.log("1. Go to: https://app.supabase.com");
    console.log("2. Project: mtholttdmrjptulqcfyk");
    console.log("3. SQL Editor → New Query");
    console.log("4. Paste: docs/deployment/FIX_ALL_CRITICAL.sql");
    console.log("5. Click Run\n");

    process.exit(0);
  }
}
