/**
 * TanStack Start RPC handlers for API endpoints
 * These are server-side functions that can be called from the client
 */

import { getDatabase } from './database'
import { saveFile } from './file-storage'
import { successResponse, errorResponse, partialSuccessResponse } from './api-response'
import { createReportRepository } from './report-repository'

/**
 * Get all reports
 */
export async function getReports() {
  try {
    const db = getDatabase()
    
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
    `)
    
    const reports = stmt.all()
    
    return successResponse({
      reports: reports.map(r => ({
        ...r,
        urgent_flag: !!r.urgent_flag,
        file_count: Number(r.file_count),
      })),
      total: reports.length,
    })
  } catch (error) {
    console.error('❌ Error fetching reports:', error)
    return errorResponse(
      'Failed to retrieve saved reports',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

/**
 * Get a specific report by ID
 */
export async function getReportById(id: string) {
  try {
    if (!id) {
      return errorResponse('Report ID is required', 400)
    }

    const db = getDatabase()
    
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
    `)
    
    const report = stmt.get(id)
    
    if (!report) {
      return errorResponse('Report not found', 404)
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
    `)
    
    const files = filesStmt.all(id)
    
    return successResponse({
      report: {
        ...report,
        urgent_flag: !!report.urgent_flag,
        consent_given: !!report.consent_given,
      },
      files: files.map(f => ({
        ...f,
        size_bytes: Number(f.size_bytes),
        gps_accuracy_meters: f.gps_accuracy_meters ? Number(f.gps_accuracy_meters) : null,
      })),
    })
  } catch (error) {
    console.error('❌ Error fetching report:', error)
    return errorResponse(
      'Failed to retrieve report',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

/**
 * Submit a new report
 */
export async function submitReport(reportData: any) {
  try {
    if (!reportData) {
      return errorResponse('Request body is required', 400)
    }

    const db = getDatabase()
    const repo = createReportRepository(db)

    // Validate required fields
    if (!reportData.incident_at || !reportData.location_text || !reportData.description) {
      return errorResponse('Missing required fields', 400)
    }

    // Create report in database
    let reportRecord
    try {
      reportRecord = repo.insertReport({
        incident_at: reportData.incident_at,
        location_text: reportData.location_text,
        city: reportData.city || null,
        incident_type: reportData.incident_type || null,
        description: reportData.description,
        injury_details: reportData.injury_details || null,
        badge_or_unit: reportData.badge_or_unit || null,
        submission_mode: reportData.submission_mode || 'anonymous',
        urgent_flag: !!reportData.urgent_flag,
        status: 'pending_moderation',
        consent_given: !!reportData.consent_given,
        witness_name: reportData.witness_name || null,
        witness_contact: reportData.witness_contact || null,
        reporter_name: reportData.reporter_name || null,
        reporter_contact: reportData.reporter_contact || null,
        gps_latitude: reportData.gps_latitude || null,
        gps_longitude: reportData.gps_longitude || null,
        gps_accuracy: reportData.gps_accuracy || null,
      })
    } catch (err) {
      console.error('❌ Error inserting report:', err)
      return errorResponse(
        'Failed to save report to database',
        500,
        err instanceof Error ? err.message : 'Unknown error'
      )
    }

    if (!reportRecord || !reportRecord.id) {
      return errorResponse('Report was not created', 500)
    }

    // Handle file uploads if provided
    let fileErrors = []
    let attachedFileCount = 0

    if (reportData.files && Array.isArray(reportData.files) && reportData.files.length > 0) {
      console.log(`📎 Processing ${reportData.files.length} files for report ${reportRecord.id}`)
      
      for (const fileData of reportData.files) {
        try {
          if (!fileData.name) {
            fileErrors.push({
              file: 'unknown',
              stage: 'validation',
              message: 'File name is missing',
            })
            continue
          }

          let fileBuffer
          if (fileData.buffer) {
            fileBuffer = fileData.buffer
          } else if (fileData.base64) {
            fileBuffer = Buffer.from(fileData.base64, 'base64')
          } else {
            fileErrors.push({
              file: fileData.name,
              stage: 'conversion',
              message: 'Could not process file data',
            })
            continue
          }

          const file = {
            name: fileData.name,
            size: fileBuffer.length || (fileData.size || 0),
            type: fileData.type || 'application/octet-stream',
            arrayBuffer: async () => fileBuffer,
          }

          if (file.size > 25 * 1024 * 1024) {
            fileErrors.push({
              file: fileData.name,
              stage: 'size',
              message: 'File exceeds 25 MB limit',
            })
            continue
          }

          const saveResult = await saveFile(reportRecord.id, file)
          
          if (!saveResult.success) {
            fileErrors.push({
              file: fileData.name,
              stage: 'storage',
              message: saveResult.error || 'File storage failed',
            })
            continue
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
            `)

            const { randomUUID } = await import('node:crypto')
            const evidenceId = randomUUID()
            const now = new Date().toISOString()

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
            )

            attachedFileCount++
          } catch (dbErr) {
            console.error('❌ Error saving file metadata:', dbErr)
            fileErrors.push({
              file: fileData.name,
              stage: 'metadata',
              message: 'File saved but metadata could not be recorded',
            })
          }
        } catch (err) {
          console.error('❌ Error processing file:', err)
          fileErrors.push({
            file: fileData.name || 'unknown',
            stage: 'processing',
            message: err instanceof Error ? err.message : 'File processing failed',
          })
        }
      }
    }

    console.log(`✓ Report ${reportRecord.id} created with ${attachedFileCount} files`)
    
    if (fileErrors.length > 0 && attachedFileCount < (reportData.files?.length || 0)) {
      return partialSuccessResponse(
        {
          id: reportRecord.id,
          report_code: reportRecord.report_code,
          created_at: reportRecord.created_at,
          files_attached: attachedFileCount,
        },
        fileErrors
      )
    }
    
    return successResponse(
      {
        id: reportRecord.id,
        report_code: reportRecord.report_code,
        created_at: reportRecord.created_at,
        files_attached: attachedFileCount,
      },
      201
    )
  } catch (error) {
    console.error('❌ Unhandled error in submitReport:', error)
    return errorResponse(
      'Failed to submit report',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
