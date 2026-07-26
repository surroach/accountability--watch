import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, ShieldCheck, ArrowLeft } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "File an incident report — Accountability Watch" },
      { name: "description", content: "Document an incident of alleged police misconduct at a protest. Anonymous, timestamped, and hashed for tamper-evidence." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "File an incident report — Accountability Watch" },
      { property: "og:description", content: "Document an incident of alleged police misconduct at a protest." },
    ],
  }),
  component: ReportPage,
});

const schema = z.object({
  incident_at: z.string().min(1, "Required"),
  location_text: z.string().trim().min(2).max(500),
  city: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10, "Please add more detail").max(5000),
  injury_details: z.string().trim().max(2000).optional(),
  badge_or_unit: z.string().trim().max(200).optional(),
  witness_name: z.string().trim().max(200).optional(),
  witness_contact: z.string().trim().max(200).optional(),
  reporter_name: z.string().trim().max(200).optional(),
  reporter_contact: z.string().trim().max(200).optional(),
});

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ReportPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ code: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) {
      toast.error("Please read and confirm the consent statement.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    try {
      const values = parsed.data;
      const { data: report, error } = await supabase
        .from("incident_reports")
        .insert({
          incident_at: new Date(values.incident_at).toISOString(),
          location_text: values.location_text,
          city: values.city || null,
          description: values.description,
          injury_details: values.injury_details || null,
          badge_or_unit: values.badge_or_unit || null,
          witness_name: values.witness_name || null,
          witness_contact: values.witness_contact || null,
          reporter_name: values.reporter_name || null,
          reporter_contact: values.reporter_contact || null,
          consent_given: true,
        })
        .select("id, report_code")
        .single();
      if (error || !report) throw error ?? new Error("Failed to save report");

      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.warning(`Skipping ${file.name} (over 25MB)`);
          continue;
        }
        const hash = await sha256Hex(file);
        const path = `${report.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("evidence").upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (upErr) {
          toast.warning(`Upload failed for ${file.name}`);
          continue;
        }
        await supabase.from("report_evidence").insert({
          report_id: report.id,
          storage_path: path,
          file_name: file.name,
          content_type: file.type || null,
          size_bytes: file.size,
          sha256: hash,
        });
      }
      setSubmitted({ code: report.report_code });
    } catch (err) {
      console.error(err);
      toast.error("Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="card-white p-10 text-center">
          <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-lime">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-bold">Report received</h1>
          <p className="mt-3 text-muted-foreground">
            Your submission has been sealed with a timestamp and file hash.
          </p>
          <p className="mt-6 font-display text-xs uppercase tracking-widest text-muted-foreground">Report ID</p>
          <p className="mt-1 font-mono text-2xl font-bold">{submitted.code}</p>
          <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
            Please save this ID. Legal partners can reference it when following up. Nothing you submitted will be published.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/" className="rounded-full border-2 border-ink px-5 py-2.5 font-display text-sm font-semibold">Home</Link>
            <button
              onClick={() => { setSubmitted(null); setFiles([]); setConsent(false); navigate({ to: "/report" }); }}
              className="rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-ink-foreground"
            >
              File another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <p className="mb-3 font-display text-xs uppercase tracking-widest">
        <span className="highlight-lime">Incident report</span>
      </p>
      <h1 className="font-display text-4xl font-bold">File a report</h1>
      <p className="mt-3 text-muted-foreground">
        All fields are private unless you say otherwise. You can leave any optional field blank.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-8">
        <Section title="When & where">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Date & time of incident" required>
              <Input type="datetime-local" name="incident_at" required />
            </Field>
            <Field label="City / area" hint="Used only for aggregate maps">
              <Input name="city" placeholder="e.g. Delhi" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Location (address, landmark, or coordinates)" required>
                <Input name="location_text" placeholder="e.g. Jantar Mantar, near Gate 3" required />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="What happened">
          <Field label="Describe the incident" required>
            <Textarea name="description" rows={6} placeholder="What did you see or experience? Include what happened, who was involved, and any actions taken by officers." required />
          </Field>
          <Field label="Injury details (optional)">
            <Textarea name="injury_details" rows={3} placeholder="Any injuries you or others sustained." />
          </Field>
        </Section>

        <Section title="Evidence">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/40 bg-muted/40 p-8 text-center hover:border-ink">
            <Upload className="mb-2 h-6 w-6" />
            <span className="font-display text-sm font-semibold">Upload photos or video</span>
            <span className="mt-1 text-xs text-muted-foreground">
              Files are hashed (SHA-256) on submission. Visible only to legal partners.
            </span>
            <input
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {files.map((f, i) => (
                <li key={i} className="font-mono">{f.name} · {(f.size / 1024).toFixed(0)} KB</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Officer identifiers (optional)">
          <Field
            label="Reported badge number or unit ID"
            hint="As reported by submitter — unverified. Never published publicly."
          >
            <Input name="badge_or_unit" placeholder="e.g. Badge 4521 / Unit RAF-3" />
          </Field>
        </Section>

        <Section title="Witness (optional)">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Witness name">
              <Input name="witness_name" />
            </Field>
            <Field label="Witness contact">
              <Input name="witness_contact" placeholder="Phone or email" />
            </Field>
          </div>
        </Section>

        <Section title="Your contact (optional)">
          <p className="mb-3 text-sm text-muted-foreground">
            Only used by legal aid for follow-up. Never public.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Your name">
              <Input name="reporter_name" />
            </Field>
            <Field label="Your contact">
              <Input name="reporter_contact" placeholder="Phone or email" />
            </Field>
          </div>
        </Section>

        <div className="card-white p-6">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              className="mt-1"
              checked={consent}
              onCheckedChange={(v) => setConsent(!!v)}
            />
            <span className="text-sm">
              I understand this report may be shared with legal aid organisations and, in aggregate
              / anonymized form, with journalists and civil rights groups. Identifying details about
              individual officers <span className="highlight-lime">will not be published</span> on this platform.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-ink px-7 py-6 font-display font-semibold text-ink-foreground hover:opacity-90"
          >
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Nothing you enter is public. A tamper-evident ID + timestamp will be created.
          </span>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-white p-6 md:p-8">
      <h2 className="mb-5 font-display text-lg font-bold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="font-display text-sm">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
