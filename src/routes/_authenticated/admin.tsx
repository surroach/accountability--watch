import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, LogOut, RefreshCw, ShieldAlert, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Accountability Watch" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Report = {
  id: string;
  report_code: string;
  incident_at: string;
  location_text: string;
  city: string | null;
  description: string;
  injury_details: string | null;
  badge_or_unit: string | null;
  witness_name: string | null;
  witness_contact: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  status: "new" | "under_review" | "referred" | "closed";
  created_at: string;
};

type Evidence = {
  id: string;
  file_name: string | null;
  storage_path: string;
  sha256: string;
  size_bytes: number | null;
  content_type: string | null;
  created_at: string;
};

const statuses = [
  { value: "new", label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "referred", label: "Referred to Legal Aid" },
  { value: "closed", label: "Closed" },
] as const;

function AdminPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState<Report | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

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

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
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
  }, [reports, query, statusFilter]);

  async function updateStatus(id: string, status: Report["status"]) {
    const { error } = await supabase.from("incident_reports").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function openReport(r: Report) {
    setOpen(r);
    const { data } = await supabase
      .from("report_evidence")
      .select("*")
      .eq("report_id", r.id)
      .order("created_at");
    setEvidence((data as Evidence[]) ?? []);
  }

  async function downloadEvidence(ev: Evidence) {
    const { data, error } = await supabase.storage.from("evidence").createSignedUrl(ev.storage_path, 300);
    if (error || !data) return toast.error("Could not generate download link");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function exportCsv() {
    const rows = filtered;
    const cols = [
      "report_code", "created_at", "incident_at", "city", "location_text", "status",
      "description", "injury_details", "badge_or_unit",
      "witness_name", "witness_contact", "reporter_name", "reporter_contact",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [cols.join(",")].concat(
      rows.map((r) => cols.map((c) => esc((r as any)[c])).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accountability-watch-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold">Access pending</h1>
          <p className="mt-3 text-muted-foreground">
            You're signed in, but your account hasn't been granted admin or legal-partner access
            yet. Contact your platform admin to be added.
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
            <span className="highlight-lime">Admin console</span>
          </p>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Reports</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            All submitted reports with full detail. Handle in accordance with your organization's data protocol.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="rounded-full">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="rounded-full">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={signOut} className="rounded-full">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search code, city, description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border-2 border-ink">
        <table className="w-full text-sm">
          <thead className="bg-ink text-ink-foreground">
            <tr>
              <Th>Code</Th>
              <Th>Incident</Th>
              <Th>City</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No reports found.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-border/60 hover:bg-muted/40">
                <Td><span className="font-mono text-xs">{r.report_code}</span></Td>
                <Td>
                  <div>{new Date(r.incident_at).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{r.location_text}</div>
                </Td>
                <Td>{r.city ?? "—"}</Td>
                <Td>
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as Report["status"])}>
                    <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => openReport(r)}>
                    <Eye className="h-4 w-4" /> View
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  <span className="font-mono text-sm">{open.report_code}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <Detail label="Incident at">{new Date(open.incident_at).toLocaleString()}</Detail>
                <Detail label="Location">{open.location_text}</Detail>
                <Detail label="City">{open.city ?? "—"}</Detail>
                <Detail label="Description"><p className="whitespace-pre-wrap">{open.description}</p></Detail>
                <Detail label="Injury details">{open.injury_details ?? "—"}</Detail>
                <Detail label="Badge / unit (as reported, unverified)">
                  <span className="rounded-md bg-lime px-2 py-0.5">{open.badge_or_unit ?? "—"}</span>
                </Detail>
                <Detail label="Witness">{open.witness_name ?? "—"} {open.witness_contact && `· ${open.witness_contact}`}</Detail>
                <Detail label="Reporter">{open.reporter_name ?? "—"} {open.reporter_contact && `· ${open.reporter_contact}`}</Detail>
                <Detail label="Submitted">{new Date(open.created_at).toLocaleString()}</Detail>

                <div>
                  <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">Evidence</p>
                  {evidence.length === 0 ? (
                    <p className="mt-2 text-muted-foreground">No files.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {evidence.map((ev) => (
                        <li key={ev.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs">{ev.file_name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">SHA-256: {ev.sha256}</p>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => downloadEvidence(ev)}>
                            <Download className="h-4 w-4" /> Open
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-3 text-left font-display text-xs uppercase tracking-wider ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 align-top ${className}`}>{children}</td>;
}
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
