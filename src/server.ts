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
            storage_path,
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
        
        // Check file existence
        const { fileExists } = await import("./server/file-storage");
        const filesWithExistence = files.map((f: any) => ({
          id: f.id,
          file_name: f.file_name,
          content_type: f.content_type,
          size_bytes: Number(f.size_bytes),
          sha256: f.sha256,
          gps_latitude: f.gps_latitude,
          gps_longitude: f.gps_longitude,
          gps_accuracy_meters: f.gps_accuracy_meters ? Number(f.gps_accuracy_meters) : null,
          media_timestamp: f.media_timestamp,
          created_at: f.created_at,
          exists: fileExists(f.storage_path),
          // storage_path intentionally NOT included in response
        }));
        
        const result = apiResponse({
          report: {
            ...report,
            urgent_flag: !!report.urgent_flag,
            consent_given: !!report.consent_given,
          },
          files: filesWithExistence,
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

    // GET /api/stats - get dashboard statistics
    if (path === "/api/stats" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");
        const cityFilter = url.searchParams.get("city_filter");

        const db = getDatabase();

        // Build date filters
        let whereClause = "WHERE 1=1";
        const params: any[] = [];

        if (fromDate) {
          whereClause += " AND incident_at >= ?";
          params.push(fromDate);
        }
        if (toDate) {
          // Add one day to include the full selected date
          const endDate = new Date(toDate);
          endDate.setUTCDate(endDate.getUTCDate() + 1);
          whereClause += " AND incident_at < ?";
          params.push(endDate.toISOString());
        }
        if (cityFilter) {
          whereClause += " AND city LIKE ?";
          params.push(cityFilter);
        }

        // Get total reports
        const totalStmt = db.prepare(`
          SELECT COUNT(*) as count FROM incident_reports ${whereClause}
        `);
        const totalResult = totalStmt.all(...params) as any[];
        const totalReports = totalResult[0]?.count || 0;

        // Get reports by city
        const cityStmt = db.prepare(`
          SELECT city, COUNT(*) as count
          FROM incident_reports
          ${whereClause}
          GROUP BY city
          ORDER BY count DESC
        `);
        const byCity = cityStmt.all(...params) as any[];

        // Get reports by month
        const monthStmt = db.prepare(`
          SELECT 
            strftime('%Y-%m', incident_at) as month,
            COUNT(*) as count
          FROM incident_reports
          ${whereClause}
          GROUP BY month
          ORDER BY month ASC
        `);
        const byMonth = monthStmt.all(...params) as any[];

        // Calculate trend
        let trend: { direction: "up" | "down" | "stable"; percentage: number } | undefined;

        if (byMonth.length >= 2) {
          const midpoint = Math.floor(byMonth.length / 2);
          const firstHalf = byMonth
            .slice(0, midpoint)
            .reduce((sum, m) => sum + (m.count || 0), 0);
          const secondHalf = byMonth
            .slice(midpoint)
            .reduce((sum, m) => sum + (m.count || 0), 0);

          if (firstHalf > 0 && secondHalf > 0) {
            const percentChange = ((secondHalf - firstHalf) / firstHalf) * 100;
            const direction =
              percentChange > 5 ? "up" : percentChange < -5 ? "down" : "stable";
            trend = {
              direction,
              percentage: Math.abs(Math.round(percentChange)),
            };
          }
        }

        const result = apiResponse({
          total_reports: totalReports,
          by_city: byCity,
          by_month: byMonth,
          trend,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error fetching stats:", error);
        const result = apiError(
          "Failed to fetch statistics",
          500,
          error instanceof Error ? error.message : "Unknown error"
        );
        return new Response(JSON.stringify(result), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // GET /api/reports/:id/files/:fileId - download a specific file
    const fileDownloadMatch = path.match(/^\/api\/reports\/([a-f0-9\-]+)\/files\/([a-f0-9\-]+)$/);
    if (fileDownloadMatch && request.method === "GET") {
      try {
        const reportId = fileDownloadMatch[1];
        const fileId = fileDownloadMatch[2];

        if (!reportId || !fileId) {
          const result = apiError("Report ID and file ID are required", 400);
          return new Response(JSON.stringify(result), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDatabase();
        
        // Get file metadata and verify it belongs to the report
        const fileStmt = db.prepare(`
          SELECT
            id,
            report_id,
            storage_path,
            file_name,
            content_type,
            size_bytes,
            sha256
          FROM report_evidence
          WHERE id = ? AND report_id = ?
        `);
        
        const fileRecord = fileStmt.get(fileId, reportId);
        
        if (!fileRecord) {
          const result = apiError("File not found", 404);
          return new Response(JSON.stringify(result), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Check if file exists
        const { fileExists, getFileBuffer } = await import("./server/file-storage");
        if (!fileExists(fileRecord.storage_path)) {
          const result = apiError("File not found in local storage", 404);
          return new Response(JSON.stringify(result), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Get file buffer
        const fileBuffer = getFileBuffer(fileRecord.storage_path);
        if (!fileBuffer) {
          const result = apiError("Could not read file", 500);
          return new Response(JSON.stringify(result), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Return file with appropriate headers
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": fileRecord.content_type || "application/octet-stream",
            "Content-Length": String(fileRecord.size_bytes),
            "Content-Disposition": `attachment; filename="${encodeURIComponent(fileRecord.file_name)}"`,
          },
        });
      } catch (error) {
        console.error("❌ Error downloading file:", error);
        const result = apiError(
          "Failed to download file",
          500,
          error instanceof Error ? error.message : "Unknown error"
        );
        return new Response(JSON.stringify(result), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // PATCH /api/reports/:id - update a report (e.g., status)
    const reportUpdateMatch = path.match(/^\/api\/reports\/([a-f0-9\-]+)$/);
    if (reportUpdateMatch && request.method === "PATCH") {
      try {
        const id = reportUpdateMatch[1];
        if (!id) {
          const result = apiError("Report ID is required", 400);
          return new Response(JSON.stringify(result), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const body = await request.json();
        const { status } = body;

        if (!status) {
          const result = apiError("Status is required", 400);
          return new Response(JSON.stringify(result), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const validStatuses = ['new', 'under_review', 'referred', 'closed', 'pending_moderation', 'moderation_approved', 'moderation_rejected'];
        if (!validStatuses.includes(status)) {
          const result = apiError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
          return new Response(JSON.stringify(result), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const db = getDatabase();
        
        // Verify report exists
        const checkStmt = db.prepare("SELECT id FROM incident_reports WHERE id = ?");
        const existing = checkStmt.all(id);
        
        if (existing.length === 0) {
          const result = apiError("Report not found", 404);
          return new Response(JSON.stringify(result), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Update status
        const updateStmt = db.prepare(`
          UPDATE incident_reports
          SET status = ?, updated_at = ?
          WHERE id = ?
        `);
        
        const now = new Date().toISOString();
        updateStmt.run(status, now, id);
        
        // Return updated report
        const getStmt = db.prepare("SELECT * FROM incident_reports WHERE id = ?");
        const updated = getStmt.all(id)[0];
        
        const result = apiResponse({
          report: {
            ...updated,
            urgent_flag: !!updated.urgent_flag,
          },
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Error updating report:", error);
        const result = apiError(
          "Failed to update report",
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
