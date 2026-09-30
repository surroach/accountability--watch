import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// This edge function executes the SQL migration for Accountability Watch
// It uses the service role key to execute privileged SQL

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// FIX_ALL_CRITICAL.sql statements
const SQL_STATEMENTS = `
-- RLS Policy Fixes
DROP POLICY IF EXISTS "anyone can attach evidence" ON public.report_evidence;
CREATE POLICY "allow_anon_insert_evidence" ON public.report_evidence
  FOR INSERT WITH CHECK (true);

-- Storage policies
DROP POLICY IF EXISTS "allow_anon_read" ON storage.objects;
CREATE POLICY "allow_anon_read_evidence" ON storage.objects
  FOR SELECT USING (bucket_id = 'evidence');

CREATE POLICY "allow_admin_read_evidence" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evidence' AND
    (SELECT user_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin' LIMIT 1) IS NOT NULL
  );

CREATE POLICY "allow_admin_delete_evidence" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'evidence' AND
    (SELECT user_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin' LIMIT 1) IS NOT NULL
  );

-- RLS for incident reports
CREATE POLICY "admin_view_reports" ON public.incident_reports
  FOR SELECT USING (
    (SELECT user_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'legal_partner') LIMIT 1) IS NOT NULL
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id_created 
  ON public.report_evidence(report_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_at 
  ON public.incident_reports(incident_at DESC);

-- Constraints
ALTER TABLE public.incident_reports
  ADD CONSTRAINT IF NOT EXISTS chk_report_city_length 
    CHECK (length(location_text) BETWEEN 2 AND 255);

ALTER TABLE public.report_evidence
  ADD CONSTRAINT IF NOT EXISTS chk_evidence_sha256_format 
    CHECK (evidence_hash ~ '^[a-f0-9]{64}$');

-- Enable RLS
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
`;

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // Verify authorization
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    // Create admin client with service role
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    console.log("🔧 Executing SQL migration...")

    // Split statements properly
    const statements = SQL_STATEMENTS
      .split(";")
      .map(s => s.trim())
      .filter(s => s && !s.startsWith("--"))

    const results: any[] = []

    // Execute each statement
    for (const statement of statements) {
      try {
        const { data, error } = await supabase.rpc("exec_sql_statement", {
          sql: statement,
        })

        if (error) {
          console.warn(`Statement failed: ${error.message}`)
          results.push({
            sql: statement.substring(0, 50),
            error: error.message,
          })
        } else {
          console.log(`✅ ${statement.substring(0, 50)}...`)
          results.push({
            sql: statement.substring(0, 50),
            success: true,
          })
        }
      } catch (err: any) {
        console.error(`Error executing statement: ${err.message}`)
        results.push({
          sql: statement.substring(0, 50),
          error: err.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        status: "complete",
        executed: statements.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error("Migration error:", error)
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
