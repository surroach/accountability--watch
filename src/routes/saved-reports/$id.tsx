import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Download,
  Calendar,
  MapPin,
  AlertCircle,
  Loader2,
  FileIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/saved-reports/$id")({
  head: () => ({
    meta: [
      { title: "Report details — Accountability Watch" },
      {
        name: "description",
        content: "View the details of a submitted report.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SavedReportDetailPage,
});

type Report = {
  id: string;
  report_code: string;
  incident_at: string;
  location_text: string;
  city?: string;
  incident_type?: string;
  description: string;
  injury_details?: string;
  badge_or_unit?: string;
  submission_mode: string;
  urgent_flag: boolean;
  status: string;
  created_at: string;
  witness_name?: string | null;
  witness_contact?: string | null;
  reporter_name?: string | null;
  reporter_contact?: string | null;
};

type ReportFile = {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha256?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_accuracy_meters?: number;
  media_timestamp?: string;
  created_at: string;
  exists: boolean;
};

type ReportDetail = {
  report: Report;
  files: ReportFile[];
};

export function SavedReportDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch report on mount
  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/reports/${id}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error?.message || "Failed to load report details"
          );
        }

        setData(result.data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred";
        setError(message);
        toast.error(`Could not load report: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [id]);

  const INCIDENT_TYPE_LABELS: Record<string, string> = {
    excessive_force: "Excessive Force",
    unlawful_detention: "Unlawful Detention",
    property_damage: "Property Damage",
    harassment: "Harassment",
    wrongful_arrest: "Wrongful Arrest",
    illegal_search: "Illegal Search or Seizure",
    lack_of_due_process: "Lack of Due Process",
    other: "Other Misconduct",
  };

  const getIncidentTypeLabel = (type?: string): string => {
    if (!type) return "Not specified";
    return (
      INCIDENT_TYPE_LABELS[type as keyof typeof INCIDENT_TYPE_LABELS] || type
    );
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "pending_moderation":
        return "bg-amber-100 text-amber-800";
      case "moderation_approved":
        return "bg-green-100 text-green-800";
      case "moderation_rejected":
        return "bg-red-100 text-red-800";
      case "under_review":
        return "bg-blue-100 text-blue-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "pending_moderation":
        return "Pending Review";
      case "moderation_approved":
        return "Approved";
      case "moderation_rejected":
        return "Rejected";
      case "under_review":
        return "Under Review";
      case "closed":
        return "Closed";
      default:
        return status;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadFile = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/reports/${id}/files/${fileId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to download file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Downloaded ${fileName}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to download file";
      console.error("Download error:", err);
      toast.error(message);
    }
  };

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading report details…
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display text-sm font-semibold text-destructive">
                Error loading report
              </p>
              <p className="mt-1 text-xs text-destructive/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <p className="font-mono text-lg font-bold text-foreground">
                {data.report.report_code}
              </p>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                  data.report.status
                )}`}
              >
                {getStatusLabel(data.report.status)}
              </span>
              {data.report.urgent_flag && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                  Urgent
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold">
              {getIncidentTypeLabel(data.report.incident_type)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.report.submission_mode === "anonymous"
                ? "Submitted anonymously"
                : "Submitted with contact information"}
            </p>
          </div>

            {/* Main details */}
            <div className="card-white space-y-6 p-5 sm:p-6 md:p-8 mb-6">
              {/* Incident info */}
              <div className="space-y-3">
                <h2 className="font-display text-lg font-bold">
                  Incident details
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Date & time
                    </p>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(
                        parseISO(data.report.incident_at),
                        "MMMM d, yyyy 'at' h:mm a"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Location
                    </p>
                    <p className="text-sm font-semibold flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span>{data.report.location_text}</span>
                    </p>
                  </div>
                </div>
                {data.report.city && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      City / area
                    </p>
                    <p className="text-sm">{data.report.city}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Description
                </h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {data.report.description}
                </p>
              </div>

              {/* Injury details if present */}
              {data.report.injury_details && (
                <div>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    Injuries
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {data.report.injury_details}
                  </p>
                </div>
              )}

              {/* Badge/unit if present */}
              {data.report.badge_or_unit && (
                <div>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    Badge / unit
                  </h3>
                  <p className="text-sm font-mono">{data.report.badge_or_unit}</p>
                </div>
              )}
            </div>

            {/* Contact info (if identified) */}
            {data.report.submission_mode === "identified" && (
              <div className="card-white space-y-4 p-5 sm:p-6 md:p-8 mb-6">
                <h2 className="font-display text-lg font-bold">
                  Contact information
                </h2>

                {data.report.witness_name && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Witness name
                    </p>
                    <p className="text-sm">{data.report.witness_name}</p>
                  </div>
                )}

                {data.report.witness_contact && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Witness contact
                    </p>
                    <p className="text-sm font-mono">{data.report.witness_contact}</p>
                  </div>
                )}

                {data.report.reporter_name && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Reporter name
                    </p>
                    <p className="text-sm">{data.report.reporter_name}</p>
                  </div>
                )}

                {data.report.reporter_contact && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Reporter contact
                    </p>
                    <p className="text-sm font-mono">{data.report.reporter_contact}</p>
                  </div>
                )}
              </div>
            )}

            {/* Files */}
            {data.files.length > 0 && (
              <div className="card-white space-y-4 p-5 sm:p-6 md:p-8 mb-6">
                <h2 className="font-display text-lg font-bold">
                  Attached files ({data.files.length})
                </h2>

                <ul className="space-y-2">
                  {data.files.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:p-4"
                    >
                      <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs sm:text-sm truncate font-semibold">
                          {file.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size_bytes)}
                          {file.content_type && ` · ${file.content_type}`}
                        </p>
                        {file.exists ? (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() =>
                                downloadFile(file.id, file.file_name)
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-1.5 font-display text-xs font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90"
                              aria-label={`Download ${file.file_name}`}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            File not found in local storage
                          </p>
                        )}
                        {file.sha256 && (
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            SHA-256: {file.sha256.substring(0, 16)}…
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata */}
            <div className="card-white space-y-3 p-5 sm:p-6 md:p-8">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Report metadata
              </h3>
              <div className="grid gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="font-mono">
                    {format(
                      parseISO(data.report.created_at),
                      "MMM d, yyyy h:mm a"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Report ID</span>
                  <span className="font-mono">{data.report.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-semibold">
                    {getStatusLabel(data.report.status)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
    </>
  );
}
