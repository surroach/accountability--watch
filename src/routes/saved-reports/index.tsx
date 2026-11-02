import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  MapPin,
  AlertCircle,
  Loader2,
  Eye,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/saved-reports/")({
  head: () => ({
    meta: [
      { title: "Saved reports — Accountability Watch" },
      {
        name: "description",
        content: "View reports you have submitted locally.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SavedReportsListPage,
});

type Report = {
  id: string;
  report_code: string;
  incident_at: string;
  location_text: string;
  city?: string;
  incident_type?: string;
  description: string;
  submission_mode: string;
  urgent_flag: boolean;
  status: string;
  created_at: string;
  file_count: number;
};

export function SavedReportsListPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch reports on mount
  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/reports");
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error?.message || "Failed to load saved reports"
          );
        }

        setReports(result.data.reports || []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred";
        setError(message);
        toast.error(`Could not load reports: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

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
    return INCIDENT_TYPE_LABELS[type as keyof typeof INCIDENT_TYPE_LABELS] || type;
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

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <p className="mb-2 font-display text-xs uppercase tracking-widest">
          <span className="highlight-lime">Reports</span>
        </p>
        <h1 className="font-display text-3xl font-bold">Saved reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reports you have submitted are stored locally and listed here.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading reports…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display text-sm font-semibold text-destructive">
                Error loading reports
              </p>
              <p className="mt-1 text-xs text-destructive/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="font-display text-sm font-semibold">
            No reports yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reports you submit will appear here.
          </p>
          <Link
            to="/report"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90"
          >
            File a report
          </Link>
        </div>
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => navigate({ to: `/saved-reports/${report.id}` })}
              className="w-full text-left rounded-lg border border-border/60 bg-card p-4 sm:p-5 hover:border-ink/50 hover:bg-card/80 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Reference code and status */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="font-mono text-sm font-bold text-foreground">
                      {report.report_code}
                    </p>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                        report.status
                      )}`}
                    >
                      {getStatusLabel(report.status)}
                    </span>
                    {report.urgent_flag && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        Urgent
                      </span>
                    )}
                  </div>

                  {/* Incident type and mode */}
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="font-semibold">
                      {getIncidentTypeLabel(report.incident_type)}
                    </span>
                    <span>·</span>
                    <span>
                      {report.submission_mode === "anonymous"
                        ? "Anonymous"
                        : "Identified"}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="mb-2 flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{report.location_text}</span>
                  </div>

                  {/* Description preview */}
                  <p className="line-clamp-2 text-xs sm:text-sm text-foreground mb-3">
                    {report.description}
                  </p>

                  {/* Metadata row */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {format(parseISO(report.incident_at), "MMM d, yyyy h:mm a")}
                    </span>
                    <span>·</span>
                    <span>
                      {report.file_count === 0
                        ? "No files"
                        : `${report.file_count} file${report.file_count !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>

                {/* Action icon */}
                <div className="flex-shrink-0">
                  <Eye className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
