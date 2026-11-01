import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  );
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as {
      unhandled?: unknown;
      message?: unknown;
    };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * API response helpers
 */
function apiResponse(data: any, statusCode = 200) {
  return {
    success: true,
    data,
    statusCode,
  };
}

function apiError(message: string, statusCode = 400, details?: string) {
  return {
    success: false,
    error: {
      message,
      details,
    },
    statusCode,
  };
}

/**
 * Handle API routes before delegating to TanStack
 */
async function handleApiRoute(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Dynamic import to avoid build issues
    const db_module = await import("./server/database");
    const repo_module = await import("./server/report-repository");
    const file_module = await import("./server/file-storage");

    const { getDatabase } = db_module;
    const { createReportRepository } = repo_module;
    const { saveFile } = file_module;

    // GET /api/reports - list all reports
    if (path === "/api/reports" && request.method === "GET") {
      try {
        const db = getDatabase();
        
        const stmt = db.prepare(`
          SELECT
            id,
            report_code,
            incident_at,
            location_text,
            city,
            incident_type,
            description,
            submission_mode,
            urgent_flag,
            status,
            created_at,
            (SELECT COUNT(*) FROM report_evidence WHERE report_id = incident_reports.id) as file_count
          FROM incident_reports
          ORDER BY created_at DESC
        `);
        
        const reports = stmt.all();
        
        const result = apiResponse({
          reports: reports.map((r: any) => ({
            ...r,
            urgent_flag: !!r.urgent_flag,
            file_count: Number(r.file_count),
          })),
          total: reports.length,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error fetching reports:", error);
        const result = apiError(
          "Failed to retrieve saved reports",
          500,
          error instanceof Error ? error.message : "Unknown error"
        );
        return new Response(JSON.stringify(result), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // POST /api/reports - submit a new report
    if (path === "/api/reports" && request.method === "POST") {
      try {
        const body = await request.json();
        
        if (!body) {
          const result = apiError("Request body is required", 400);
          return new Response(JSON.stringify(result), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDatabase();
        const repo = createReportRepository(db);

        // Validate required fields
        if (!body.incident_at || !body.location_text || !body.description) {
          const result = apiError("Missing required fields", 400);
          return new Response(JSON.stringify(result), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Create report in database
        let reportRecord;
        try {
          reportRecord = repo.insertReport({
            incident_at: body.incident_at,
            location_text: body.location_text,
            city: body.city || null,
            incident_type: body.incident_type || null,
            description: body.description,
            injury_details: body.injury_details || null,
            badge_or_unit: body.badge_or_unit || null,
            submission_mode: body.submission_mode || "anonymous",
            urgent_flag: !!body.urgent_flag,
            status: "pending_moderation",
            consent_given: !!body.consent_given,
            witness_name: body.witness_name || null,
            witness_contact: body.witness_contact || null,
            reporter_name: body.reporter_name || null,
            reporter_contact: body.reporter_contact || null,
            gps_latitude: body.gps_latitude || null,
            gps_longitude: body.gps_longitude || null,
            gps_accuracy: body.gps_accuracy || null,
          });
        } catch (err) {
          console.error("❌ Error inserting report:", err);
          const result = apiError(
            "Failed to save report to database",
            500,
            err instanceof Error ? err.message : "Unknown error"
          );
          return new Response(JSON.stringify(result), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!reportRecord || !reportRecord.id) {
          const result = apiError("Report was not created", 500);
          return new Response(JSON.stringify(result), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Handle file uploads if provided
        let fileErrors: any[] = [];
        let attachedFileCount = 0;

        if (body.files && Array.isArray(body.files) && body.files.length > 0) {
          console.log(`📎 Processing ${body.files.length} files for report ${reportRecord.id}`);
          
          for (const fileData of body.files) {
            try {
              if (!fileData.name) {
                fileErrors.push({
                  file: "unknown",
                  stage: "validation",
                  message: "File name is missing",
                });
                continue;
              }

              let fileBuffer;
              if (fileData.buffer) {
                fileBuffer = fileData.buffer;
              } else if (fileData.base64) {
                fileBuffer = Buffer.from(fileData.base64, "base64");
              } else {
                fileErrors.push({
                  file: fileData.name,
                  stage: "conversion",
                  message: "Could not process file data",
                });
                continue;
              }

              const file = {
                name: fileData.name,
                size: fileBuffer.length || (fileData.size || 0),
                type: fileData.type || "application/octet-stream",
                arrayBuffer: async () => fileBuffer,
              };

              if (file.size > 25 * 1024 * 1024) {
                fileErrors.push({
                  file: fileData.name,
                  stage: "size",
                  message: "File exceeds 25 MB limit",
                });
                continue;
              }

              const saveResult = await saveFile(reportRecord.id, file);
              
              if (!saveResult.success) {
                fileErrors.push({
                  file: fileData.name,
                  stage: "storage",
                  message: saveResult.error || "File storage failed",
                });
                continue;
              }

              try {
                const evidenceStmt = db.prepare(`
                  INSERT INTO report_evidence (
                    id,
                    report_id,
                    storage_path,
                    file_name,
                    content_type,
                    size_bytes,
                    sha256,
                    gps_latitude,
                    gps_longitude,
                    gps_accuracy_meters,
                    media_timestamp,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const { randomUUID } = await import("node:crypto");
                const evidenceId = randomUUID();
                const now = new Date().toISOString();

                evidenceStmt.run(
                  evidenceId,
                  reportRecord.id,
                  saveResult.storagePath,
                  fileData.name,
                  file.type,
                  file.size,
                  fileData.sha256 || null,
                  fileData.gps_latitude || null,
                  fileData.gps_longitude || null,
                  fileData.gps_accuracy || null,
                  fileData.media_timestamp || null,
                  now,
                  now
                );

                attachedFileCount++;
              } catch (dbErr) {
                console.error("❌ Error saving file metadata:", dbErr);
                fileErrors.push({
                  file: fileData.name,
                  stage: "metadata",
                  message: "File saved but metadata could not be recorded",
                });
              }
            } catch (err) {
              console.error("❌ Error processing file:", err);
              fileErrors.push({
                file: fileData.name || "unknown",
                stage: "processing",
                message: err instanceof Error ? err.message : "File processing failed",
              });
            }
          }
        }

        console.log(`✓ Report ${reportRecord.id} created with ${attachedFileCount} files`);
        
        const result = apiResponse({
          id: reportRecord.id,
          report_code: reportRecord.report_code,
          created_at: reportRecord.created_at,
          files_attached: attachedFileCount,
        }, fileErrors.length > 0 && attachedFileCount < (body.files?.length || 0) ? 207 : 201);

        if (fileErrors.length > 0) {
          (result as any).fileErrors = fileErrors;
        }

        return new Response(JSON.stringify(result), {
          status: result.statusCode,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Unhandled error in POST /api/reports:", error);
        const result = apiError(
          "Failed to submit report",
          500,
          error instanceof Error ? error.message : "Unknown error"
        );
        return new Response(JSON.stringify(result), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // GET /api/reports/:id - get a specific report
    const reportIdMatch = path.match(/^\/api\/reports\/([a-f0-9\-]+)$/);
    if (reportIdMatch && request.method === "GET") {
      try {
        const id = reportIdMatch[1];
        if (!id) {
          const result = apiError("Report ID is required", 400);
          return new Response(JSON.stringify(result), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDatabase();
        
        const stmt = db.prepare(`
          SELECT
            id,
            report_code,
            incident_at,
            location_text,
            city,
            incident_type,
            description,
            injury_details,
            badge_or_unit,
            submission_mode,
            urgent_flag,
            consent_given,
            status,
            witness_name,
            witness_contact,
            reporter_name,
            reporter_contact,
            gps_latitude,
            gps_longitude,
            gps_accuracy,
            created_at,
            updated_at
          FROM incident_reports
          WHERE id = ?
        `);
        
        const report = stmt.get(id);
        
        if (!report) {
          const result = apiError("Report not found", 404);
          return new Response(JSON.stringify(result), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const filesStmt = db.prepare(`
          SELECT
            id,
            file_name,
            content_type,
            size_bytes,
            sha256,
            gps_latitude,
            gps_longitude,
            gps_accuracy_meters,
            media_timestamp,
            created_at
          FROM report_evidence
          WHERE report_id = ?
          ORDER BY created_at ASC
        `);
        
        const files = filesStmt.all(id);
        
        const result = apiResponse({
          report: {
            ...report,
            urgent_flag: !!report.urgent_flag,
            consent_given: !!report.consent_given,
          },
          files: files.map((f: any) => ({
            ...f,
            size_bytes: Number(f.size_bytes),
            gps_accuracy_meters: f.gps_accuracy_meters ? Number(f.gps_accuracy_meters) : null,
          })),
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error fetching report:", error);
        const result = apiError(
          "Failed to retrieve report",
          500,
          error instanceof Error ? error.message : "Unknown error"
        );
        return new Response(JSON.stringify(result), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  } catch (error) {
    console.error("❌ API module error:", error);
    return new Response(
      JSON.stringify(apiError("Internal server error", 500)),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Check for API routes first
      const apiResponse = await handleApiRoute(request);
      if (apiResponse) {
        return apiResponse;
      }

      // Delegate to TanStack for everything else
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
