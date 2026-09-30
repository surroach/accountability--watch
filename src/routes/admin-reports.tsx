import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Trash2, Eye, EyeOff } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-reports")({
  head: () => ({
    meta: [
      { title: "Admin: View Reports — Accountability Watch" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReportsPage,
});

interface Report {
  id: string;
  report_code: string;
  incident_at: string;
  location_text: string;
  city: string;
  description: string;
  incident_type: string;
  submission_mode: string;
  urgent_flag: boolean;
  status: string;
  created_at: string;
  badge_or_unit?: string;
  witness_name?: string;
  reporter_name?: string;
}

interface Evidence {
  id: string;
  report_id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  content_type: string;
  sha256: string;
  created_at: string;
}

function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [evidence, setEvidence] = useState<Map<string, Evidence[]>>(new Map());
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [imageDataUrls, setImageDataUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadReports();
  }, []);

  function loadReports() {
    try {
      // Access the debug store from window
      const store = (window as any).__KIRO_REPORTS_STORE;
      if (!store || !store.incident_reports) {
        console.error("No reports store found");
        return;
      }

      const allReports = store.incident_reports;
      const allEvidence = store.report_evidence || [];

      setReports(allReports);

      // Group evidence by report_id
      const evidenceMap = new Map<string, Evidence[]>();
      allEvidence.forEach((ev: Evidence) => {
        if (!evidenceMap.has(ev.report_id)) {
          evidenceMap.set(ev.report_id, []);
        }
        evidenceMap.get(ev.report_id)!.push(ev);
      });
      setEvidence(evidenceMap);
    } catch (err) {
      console.error("Error loading reports:", err);
    }
  }

  function getFilteredReports() {
    let filtered = reports;

    if (filter === "urgent") {
      filtered = filtered.filter(r => r.urgent_flag);
    } else if (filter === "anonymous") {
      filtered = filtered.filter(r => r.submission_mode === "anonymous");
    } else if (filter === "named") {
      filtered = filtered.filter(r => r.submission_mode === "identified");
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(r =>
        r.location_text.toLowerCase().includes(search) ||
        r.description.toLowerCase().includes(search) ||
        r.report_code.toLowerCase().includes(search)
      );
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  function downloadReport(report: Report) {
    const csv = [
      ["Field", "Value"],
      ["Report Code", report.report_code],
      ["Submitted", new Date(report.created_at).toLocaleString()],
      ["Incident Date", new Date(report.incident_at).toLocaleString()],
      ["Location", `${report.location_text}${report.city ? ' (' + report.city + ')' : ''}`],
      ["Type", report.incident_type],
      ["Mode", report.submission_mode],
      ["Urgent", report.urgent_flag ? "Yes" : "No"],
      ["Status", report.status],
      ["Description", report.description],
      ["Badge/Unit", report.badge_or_unit || "N/A"],
      ["Witness", report.witness_name || "N/A"],
      ["Reporter", report.reporter_name || "N/A"],
    ]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${report.report_code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function deleteReport(reportId: string) {
    if (confirm("Are you sure you want to delete this report?")) {
      const store = (window as any).__KIRO_REPORTS_STORE;
      if (store && store.incident_reports) {
        store.incident_reports = store.incident_reports.filter((r: Report) => r.id !== reportId);
        loadReports();
        setSelectedReport(null);
      }
    }
  }

  const filteredReports = getFilteredReports();
  const reportEvidenceList = selectedReport ? evidence.get(selectedReport.id) || [] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">📊 Admin Dashboard</h1>
          </div>
          <div className="text-sm text-gray-600">
            {reports.length} reports • {reports.filter(r => r.urgent_flag).length} urgent
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Reports List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold mb-4">Reports</h2>
                
                <div className="space-y-3">
                  <Input
                    placeholder="Search..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="text-sm"
                  />

                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Filter..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reports</SelectItem>
                      <SelectItem value="urgent">Urgent Only</SelectItem>
                      <SelectItem value="anonymous">Anonymous</SelectItem>
                      <SelectItem value="named">Named</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {filteredReports.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No reports found
                  </div>
                ) : (
                  filteredReports.map(report => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`w-full text-left p-3 hover:bg-gray-50 transition ${
                        selectedReport?.id === report.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                      }`}
                    >
                      <div className="font-semibold text-sm">{report.report_code}</div>
                      <div className="text-xs text-gray-600 mt-1">{report.location_text}</div>
                      <div className="flex gap-1 mt-2">
                        {report.urgent_flag && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Urgent</span>}
                        {report.submission_mode === "anonymous" && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Anon</span>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Report Details & Images */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="space-y-4">
                {/* Report Details */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selectedReport.report_code}</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Submitted {new Date(selectedReport.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReport(selectedReport)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteReport(selectedReport.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">LOCATION</label>
                      <p className="mt-1">{selectedReport.location_text}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">CITY</label>
                      <p className="mt-1">{selectedReport.city || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">INCIDENT TYPE</label>
                      <p className="mt-1">{selectedReport.incident_type}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">STATUS</label>
                      <p className="mt-1">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                          {selectedReport.status}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="text-xs font-semibold text-gray-500">DESCRIPTION</label>
                    <p className="mt-2 p-3 bg-gray-50 rounded">{selectedReport.description}</p>
                  </div>

                  {selectedReport.badge_or_unit && (
                    <div className="mt-4 p-3 bg-blue-50 rounded">
                      <label className="text-xs font-semibold text-gray-500">BADGE/UNIT</label>
                      <p className="mt-1">{selectedReport.badge_or_unit}</p>
                    </div>
                  )}
                </div>

                {/* Evidence Images */}
                {reportEvidenceList.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold mb-4">📸 Evidence ({reportEvidenceList.length} files)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {reportEvidenceList.map(ev => (
                        <div key={ev.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400">
                            {ev.content_type.startsWith("image/") ? (
                              <div className="text-center">
                                <Eye className="h-8 w-8 mx-auto mb-2" />
                                <p className="text-xs">{ev.file_name}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {(ev.size_bytes / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <EyeOff className="h-8 w-8 mx-auto mb-2" />
                                <p className="text-xs">{ev.file_name}</p>
                                <p className="text-xs text-gray-500 mt-1">{ev.content_type}</p>
                              </div>
                            )}
                          </div>
                          <div className="p-2 bg-gray-50 text-xs">
                            <p className="font-mono text-gray-600 truncate" title={ev.sha256}>
                              {ev.sha256.substring(0, 16)}...
                            </p>
                            <p className="text-gray-500 mt-1">
                              {new Date(ev.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportEvidenceList.length === 0 && (
                  <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                    <p>No evidence files attached</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                <p>Select a report to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
