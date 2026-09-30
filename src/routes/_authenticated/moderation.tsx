import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, LogOut, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation Queue — Accountability Watch" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModerationPage,
});

type Report = {
  id: string;
  report_code: string;
  incident_at: string;
  location_text: string;
  city: string | null;
  description: string;
  incident_type: string | null;
  urgent_flag: boolean;
  submission_mode: string;
  status: string;
  created_at: string;
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  excessive_force: "Excessive Force",
  unlawful_detention: "Unlawful Detention",
  property_damage: "Property Damage",
  harassment: "Harassment",
  wrongful_arrest: "Wrongful Arrest",
  illegal_search: "Illegal Search",
  lack_of_due_process: "Lack of Due Process",
  other: "Other",
};

function ModerationPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending_moderation");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [open, setOpen] = useState<Report | null>(null);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("incident_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "PGRST301" || error.message.toLowerCase().includes("permission")) {
        setHasAccess(false);
      } else {
        toast.error(error.message);
      }
    } else {
      setHasAccess(true);
      setReports((data as Report[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (urgentOnly && !r.urgent_flag) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          r.report_code.toLowerCase().includes(q) ||
          r.location_text.toLowerCase().includes(q) ||
          (r.city ?? "").toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, query, statusFilter, urgentOnly]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("incident_reports")
      .update({ status, is_moderated: status === "moderation_approved" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, is_moderated: status === "moderation_approved" } : r
      )
    );
  }

  async function approveReport(id: string) {
    await updateStatus(id, "moderation_approved");
    setOpen(null);
  }

  async function rejectReport(id: string) {
    await updateStatus(id, "moderation_rejected");
    setOpen(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (hasAccess === false) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="card-white p-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold">Access pending</h1>
          <p className="mt-3 text-muted-foreground">
            You're signed in, but your account hasn't been granted moderation access yet. Contact your platform admin.
          </p>
          <Button onClick={signOut} variant="outline" className="mt-6 rounded-full">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-display text-xs uppercase tracking-widest">
            <span className="highlight-lime">Moderation</span>
          </p>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Review queue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve or reject reports before they appear in public aggregate statistics.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut} className="rounded-full">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <Input
          className="max-w-xs"
          placeholder="Search reports..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_moderation">Pending Review</SelectItem>
            <SelectItem value="moderation_approved">Approved</SelectItem>
            <SelectItem value="moderation_rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
          <Checkbox
            checked={urgentOnly}
            onCheckedChange={(v) => setUrgentOnly(!!v)}
          />
          <span className="text-sm flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Urgent only
          </span>
        </label>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading reports...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No reports found</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setOpen(r)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{r.report_code}</p>
                    {r.urgent_flag && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
                    {r.submission_mode === "anonymous" && (
                      <Badge variant="outline" className="text-xs">Anonymous</Badge>
                    )}
                    {r.incident_type && (
                      <Badge variant="secondary" className="text-xs">
                        {INCIDENT_TYPE_LABELS[r.incident_type] || r.incident_type}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground">{r.location_text}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs font-semibold ${
                      r.status === "moderation_approved"
                        ? "text-lime"
                        : r.status === "moderation_rejected"
                          ? "text-destructive"
                          : "text-amber-600"
                    }`}
                  >
                    {r.status === "pending_moderation"
                      ? "Pending"
                      : r.status === "moderation_approved"
                        ? "Approved"
                        : "Rejected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{open.report_code}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">SUBMITTED</p>
                  <p className="mt-1 text-sm">
                    {new Date(open.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">INCIDENT DATE</p>
                  <p className="mt-1 text-sm">
                    {new Date(open.incident_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">LOCATION</p>
                  <p className="mt-1 text-sm">{open.location_text}</p>
                </div>
                {open.city && (
                  <div>
                    <p className="text-xs text-muted-foreground">CITY</p>
                    <p className="mt-1 text-sm">{open.city}</p>
                  </div>
                )}
                {open.incident_type && (
                  <div>
                    <p className="text-xs text-muted-foreground">INCIDENT TYPE</p>
                    <p className="mt-1 text-sm">
                      {INCIDENT_TYPE_LABELS[open.incident_type] || open.incident_type}
                    </p>
                  </div>
                )}
                {open.urgent_flag && (
                  <div>
                    <p className="text-xs text-muted-foreground">PRIORITY</p>
                    <p className="mt-1">
                      <Badge variant="destructive" className="text-xs font-semibold">
                        🚨 URGENT
                      </Badge>
                    </p>
                  </div>
                )}
                {open.submission_mode === "anonymous" && (
                  <div>
                    <p className="text-xs text-muted-foreground">SUBMISSION MODE</p>
                    <p className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        Anonymous
                      </Badge>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">DESCRIPTION</p>
                <p className="mt-2 text-sm">{open.description}</p>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                {open.status === "pending_moderation" ? (
                  <>
                    <p className="text-sm font-semibold">Approve or reject this report?</p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => approveReport(open.id)}
                        className="flex-1 rounded-lg bg-lime text-ink hover:opacity-90"
                      >
                        <CheckCircle className="h-4 w-4" /> Approve
                      </Button>
                      <Button
                        onClick={() => rejectReport(open.id)}
                        variant="destructive"
                        className="flex-1 rounded-lg"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>Status:</strong>{" "}
                      {open.status === "moderation_approved" ? "Approved" : "Rejected"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
