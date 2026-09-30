#!/usr/bin/env node
/**
 * View all submitted reports from in-memory database
 */

console.log("\n╔════════════════════════════════════════════════════════╗");
console.log("║            SUBMITTED REPORTS VIEWER                    ║");
console.log("║            Local In-Memory Database                    ║");
console.log("╚════════════════════════════════════════════════════════╝\n");

// This is a simplified viewer - in real app you'd access via API
// For now, we'll show you WHERE the data is and HOW to access it

console.log("📍 WHERE YOUR DATA IS STORED:\n");
console.log("Location: Browser Memory (JavaScript Store)");
console.log(
  "Database: In-memory object in src/integrations/supabase/client.ts",
);
console.log("Table: incident_reports\n");

console.log("📋 HOW TO VIEW YOUR DATA:\n");

console.log("Option 1: Browser Console (F12)\n");
console.log("  1. Open http://localhost:8080");
console.log("  2. Press F12 to open Developer Tools");
console.log("  3. Go to Console tab");
console.log("  4. Paste this command:");
console.log("     window.__DEBUG_STORE = true; console.log(localStorage);\n");

console.log("Option 2: Create a Debug Dashboard\n");
console.log("  We'll create a simple page to view all reports...\n");

// Create a simple HTML page to view reports
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reports Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 30px; color: #333; }
    .stats { 
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card h3 { font-size: 14px; color: #666; margin-bottom: 10px; }
    .stat-card .number { font-size: 32px; font-weight: bold; color: #1e88e5; }
    .reports {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
      gap: 20px;
    }
    .report-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-left: 4px solid #1e88e5;
    }
    .report-card h3 { margin-bottom: 10px; color: #333; }
    .report-card .meta { 
      font-size: 12px;
      color: #999;
      margin-bottom: 15px;
    }
    .report-card p { 
      line-height: 1.6;
      color: #555;
      margin-bottom: 10px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      margin-right: 5px;
    }
    .badge.anonymous { background: #e3f2fd; color: #1976d2; }
    .badge.urgent { background: #ffebee; color: #c62828; }
    .badge.mode { background: #f3e5f5; color: #6a1b9a; }
    .no-data {
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }
    .json-viewer {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      overflow-x: auto;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Submitted Reports Dashboard</h1>
    
    <div class="stats">
      <div class="stat-card">
        <h3>Total Reports</h3>
        <div class="number" id="total-count">0</div>
      </div>
      <div class="stat-card">
        <h3>Anonymous Reports</h3>
        <div class="number" id="anon-count">0</div>
      </div>
      <div class="stat-card">
        <h3>Named Reports</h3>
        <div class="number" id="named-count">0</div>
      </div>
      <div class="stat-card">
        <h3>Urgent Reports</h3>
        <div class="number" id="urgent-count">0</div>
      </div>
    </div>

    <div id="reports" class="reports"></div>
    <div id="no-data" class="no-data" style="display: none;">
      No reports submitted yet. Go to the <a href="/">report form</a> to submit one.
    </div>
  </div>

  <script>
    // Fetch reports from browser localStorage or memory
    async function loadReports() {
      try {
        // Try to get data from sessionStorage (set by the app)
        const stored = sessionStorage.getItem('__reports_debug');
        let reports = [];
        
        if (stored) {
          reports = JSON.parse(stored);
        } else {
          // If not found, show message
          document.getElementById('no-data').style.display = 'block';
          return;
        }

        if (reports.length === 0) {
          document.getElementById('no-data').style.display = 'block';
          return;
        }

        // Update stats
        document.getElementById('total-count').textContent = reports.length;
        document.getElementById('anon-count').textContent = reports.filter(r => r.submission_mode === 'anonymous').length;
        document.getElementById('named-count').textContent = reports.filter(r => r.submission_mode === 'identified').length;
        document.getElementById('urgent-count').textContent = reports.filter(r => r.urgent_flag).length;

        // Render reports
        const container = document.getElementById('reports');
        container.innerHTML = reports.map(report => \`
          <div class="report-card">
            <h3>Report #\${report.report_code}</h3>
            <div class="meta">
              Submitted: \${new Date(report.created_at).toLocaleString()}
            </div>
            <div>
              <span class="badge anonymous">\${report.submission_mode === 'anonymous' ? '🔒 Anonymous' : '👤 Named'}</span>
              \${report.urgent_flag ? '<span class="badge urgent">⚠️ Urgent</span>' : ''}
              <span class="badge mode">\${report.incident_type || 'Other'}</span>
            </div>
            <p><strong>Location:</strong> \${report.location_text} \${report.city ? '(' + report.city + ')' : ''}</p>
            <p><strong>Description:</strong> \${report.description.substring(0, 100)}...</p>
            \${report.badge_or_unit ? '<p><strong>Badge/Unit:</strong> ' + report.badge_or_unit + '</p>' : ''}
            <p><strong>Status:</strong> \${report.status}</p>
            <div class="json-viewer">
              <pre>\${JSON.stringify(report, null, 2)}</pre>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        console.error('Error loading reports:', err);
        document.getElementById('no-data').style.display = 'block';
      }
    }

    loadReports();
    
    // Refresh every 2 seconds
    setInterval(loadReports, 2000);
  </script>
</body>
</html>
`;

// Save the viewer
const fs = await import("fs");
const path = await import("path");
const viewerPath = path.join(
  "/accountability-watch/public/reports-viewer.html",
);

try {
  fs.mkdirSync("/accountability-watch/public", { recursive: true });
  fs.writeFileSync(viewerPath, htmlContent);
  console.log("✅ Created viewer at: public/reports-viewer.html\n");
  console.log("📖 Access it at: http://localhost:8080/reports-viewer.html\n");
} catch (err) {
  console.log("Note: Could not create file, but here's the structure:\n");
}

console.log("═══════════════════════════════════════════════════════\n");
console.log("REAL-TIME DATA ACCESS:\n");
console.log("The reports are stored in memory in your browser.\n");
console.log("To see them:\n");
console.log("1. Open Browser DevTools (F12)");
console.log("2. Go to Console tab");
console.log("3. Type: window.__KIRO_REPORTS_STORE");
console.log("4. Press Enter\n");
console.log("You'll see all submitted reports as JSON.\n");

console.log("═══════════════════════════════════════════════════════\n");
