import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  LogOut,
  MapPin,
  Clock,
  X,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { z } from "zod";
import * as exifr from "exifr";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "File an incident report — Accountability Watch" },
      {
        name: "description",
        content:
          "Document an incident of alleged police misconduct at a protest. Anonymous, timestamped, and hashed for tamper-evidence.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportPage,
});

const INCIDENT_TYPES = [
  { value: "excessive_force", label: "Excessive Force" },
  { value: "unlawful_detention", label: "Unlawful Detention" },
  { value: "property_damage", label: "Property Damage" },
  { value: "harassment", label: "Harassment" },
  { value: "wrongful_arrest", label: "Wrongful Arrest" },
  { value: "illegal_search", label: "Illegal Search or Seizure" },
  { value: "lack_of_due_process", label: "Lack of Due Process" },
  { value: "other", label: "Other Misconduct" },
];

const STEPS = [
  { number: 1, label: "What happened" },
  { number: 2, label: "Evidence" },
  { number: 3, label: "Contact" },
  { number: 4, label: "Review & submit" },
];

// Per-step schemas for inline validation
const step1Schema = z.object({
  incident_at: z
    .string()
    .min(1, "Date and time are required")
    .refine((dt) => {
      const d = new Date(dt + "Z");
      const now = new Date();
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      return d < now && d > oneYearAgo;
    }, "Incident date must be within the last year"),
  location_text: z.string().trim().min(2, "Location is required").max(500),
  city: z.string().trim().max(120).optional(),
  incident_type: z.string().optional(),
  description: z
    .string()
    .trim()
    .min(10, "Please add more detail (at least 10 characters)")
    .max(5000),
  injury_details: z.string().trim().max(2000).optional(),
  badge_or_unit: z.string().trim().max(200).optional(),
});

const step3Schema = z.object({
  witness_name: z.string().trim().max(200).optional(),
  witness_contact: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((val) => {
      if (!val) return true; // optional
      // Basic email or phone validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[\d\s\-\+\(\)]{7,}$/;
      return emailRegex.test(val) || phoneRegex.test(val);
    }, "Contact should be valid email or phone number"),
  reporter_name: z.string().trim().max(200).optional(),
  reporter_contact: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((val) => {
      if (!val) return true; // optional
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[\d\s\-\+\(\)]{7,}$/;
      return emailRegex.test(val) || phoneRegex.test(val);
    }, "Contact should be valid email or phone number"),
});

type FileMeta = {
  lat?: number;
  lon?: number;
  accuracy?: number;
  timestamp?: string;
};
type FieldErrors = Record<string, string>;

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function extractFileMeta(file: File): Promise<FileMeta | null> {
  try {
    if (!file.type.startsWith("image/")) return null;
    const data = await exifr.parse(file, {
      gps: true,
      pick: [
        "GPSLatitude",
        "GPSLongitude",
        "GPSAccuracy",
        "DateTime",
        "DateTimeOriginal",
      ],
    });
    if (!data) return null;
    const result: FileMeta = {};
    if (data.GPSLatitude && data.GPSLongitude) {
      result.lat = data.GPSLatitude;
      result.lon = data.GPSLongitude;
      if (data.GPSAccuracy) result.accuracy = data.GPSAccuracy;
    }
    const dt = data.DateTimeOriginal || data.DateTime;
    if (dt instanceof Date) result.timestamp = dt.toISOString();
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressIndicator({ step }: { step: number }) {
  return (
    <nav aria-label="Report progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = step > s.number;
          const active = step === s.number;
          return (
            <li key={s.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold transition-none
                    ${done ? "border-ink bg-ink text-ink-foreground" : active ? "border-ink bg-lime text-ink" : "border-border bg-background text-muted-foreground"}`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? "✓" : s.number}
                </div>
                <span
                  className={`hidden font-display text-xs sm:block ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 ${done ? "bg-ink" : "bg-border"}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Quick Exit ────────────────────────────────────────────────────────────────
function QuickExit() {
  // FIX #4: Make quick exit configurable, use safer default
  const quickExitURL =
    import.meta.env.VITE_QUICK_EXIT_URL || "https://www.wikipedia.org";

  return (
    <button
      onClick={() => {
        window.location.replace(quickExitURL);
      }}
      className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border-2 border-destructive bg-background px-3 py-2 font-display text-xs font-bold text-destructive shadow-lg hover:bg-destructive hover:text-destructive-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive"
      title="Quick exit — leaves this page immediately"
      aria-label="Quick exit — leaves this page immediately"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      Quick Exit
    </button>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="font-display text-sm font-semibold">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-1.5 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ── Drag-and-drop upload zone ─────────────────────────────────────────────────
function UploadZone({
  files,
  fileMetadata,
  onFilesChange,
}: {
  files: File[];
  fileMetadata: Map<string, FileMeta>;
  onFilesChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function addFiles(incoming: File[]) {
    const next = [...files];
    for (const f of incoming) {
      // FIX #2: Add file size validation on frontend
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 25 MB limit`);
        continue;
      }
      // Check for duplicates
      if (!next.find((x) => x.name === f.name && x.size === f.size)) {
        next.push(f);
      }
    }
    onFilesChange(next);
    for (const f of incoming) {
      // Skip metadata extraction for oversized files
      if (f.size > 25 * 1024 * 1024) continue;
      const meta = await extractFileMeta(f);
      if (meta) fileMetadata.set(f.name, meta);
    }
    if (incoming.some((f) => fileMetadata.has(f.name))) {
      toast.info(
        "GPS / timestamp metadata detected — will be included for verification.",
      );
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [files],
  );

  function removeFile(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    onFilesChange(next);
  }

  function previewUrl(f: File) {
    if (f.type.startsWith("image/")) return URL.createObjectURL(f);
    return null;
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload photos or video — click or drag files here"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink
          ${dragging ? "border-ink bg-lime/20" : "border-ink/30 bg-muted/40 hover:border-ink hover:bg-muted/60"}`}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-display text-sm font-semibold">
          Drag files here, or tap to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Photos, video, PDF — max 25 MB each
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Files are hashed (SHA-256) and visible only to legal partners
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf"
          className="sr-only"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {files.map((f, i) => {
            const url = previewUrl(f);
            const meta = fileMetadata.get(f.name);
            return (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
              >
                {url ? (
                  <img
                    src={url}
                    alt={f.name}
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover border border-border"
                    onLoad={() => URL.revokeObjectURL(url)}
                  />
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground font-mono">
                    {f.name.split(".").pop()?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.size / 1024).toFixed(0)} KB
                  </p>
                  {meta && (
                    <div className="mt-1 space-y-0.5">
                      {meta.lat && meta.lon && (
                        <p className="flex items-center gap-1 text-xs text-foreground/70">
                          <MapPin className="h-3 w-3" aria-hidden />
                          GPS: {meta.lat.toFixed(4)}°, {meta.lon.toFixed(4)}°
                        </p>
                      )}
                      {meta.timestamp && (
                        <p className="flex items-center gap-1 text-xs text-foreground/70">
                          <Clock className="h-3 w-3" aria-hidden />
                          Taken: {new Date(meta.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="flex-shrink-0 rounded p-1 hover:bg-muted focus-visible:outline focus-visible:outline-2"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
function ReportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [incidentAt, setIncidentAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [city, setCity] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [description, setDescription] = useState("");
  const [injuryDetails, setInjuryDetails] = useState("");
  const [badgeOrUnit, setBadgeOrUnit] = useState("");

  // Step 2 state
  const [files, setFiles] = useState<File[]>([]);
  const [fileMetadata] = useState<Map<string, FileMeta>>(new Map());

  // Step 3 state
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [witnessContact, setWitnessContact] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");

  // Step 4 state
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ code: string } | null>(null);

  // Inline validation errors (validate on blur / step advance)
  const [errors, setErrors] = useState<FieldErrors>({});

  function validateStep1(): boolean {
    const result = step1Schema.safeParse({
      incident_at: incidentAt,
      location_text: locationText,
      city,
      incident_type: incidentType,
      description,
      injury_details: injuryDetails,
      badge_or_unit: badgeOrUnit,
    });
    if (result.success) {
      setErrors({});
      return true;
    }
    const errs: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      if (!errs[key]) errs[key] = issue.message;
    }
    setErrors(errs);
    return false;
  }

  function validateField(name: string, value: string) {
    const partial = step1Schema.shape[name as keyof typeof step1Schema.shape];
    if (!partial) return;
    const result = (partial as z.ZodType).safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [name]: result.success
        ? ""
        : (result.error.issues[0]?.message ?? "Invalid"),
    }));
  }

  function advanceStep() {
    if (step === 1 && !validateStep1()) {
      toast.error("Please fix the highlighted fields before continuing.");
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function backStep() {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function onSubmit() {
    if (!consent) {
      toast.error("Please confirm the consent statement to submit.");
      return;
    }

    // Validate step 1
    if (
      !step1Schema.safeParse({
        incident_at: incidentAt,
        location_text: locationText,
        city,
        incident_type: incidentType,
        description,
        injury_details: injuryDetails,
        badge_or_unit: badgeOrUnit,
      }).success
    ) {
      toast.error("Please fill in all required fields correctly");
      setStep(1);
      return;
    }

    // Validate step 3
    if (
      !step3Schema.safeParse({
        witness_name: witnessName,
        witness_contact: witnessContact,
        reporter_name: reporterName,
        reporter_contact: reporterContact,
      }).success
    ) {
      toast.error("Please correct the contact information");
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      // FIX #1: Convert datetime-local string to proper ISO timestamp
      if (!incidentAt) throw new Error("Date and time are required");

      const incidentDate = new Date(incidentAt + "Z").toISOString();

      const reportData: Record<string, unknown> = {
        incident_at: incidentDate,
        location_text: locationText?.trim() || "",
        city: city?.trim() || null,
        incident_type: incidentType || null,
        description: description?.trim() || "",
        injury_details: injuryDetails?.trim() || null,
        badge_or_unit: badgeOrUnit?.trim() || null,
        submission_mode: isAnonymous ? "anonymous" : "identified",
        urgent_flag: isUrgent || false,
        status: "pending_moderation",
        consent_given: true,
        witness_name: isAnonymous ? null : witnessName?.trim() || null,
        witness_contact: isAnonymous ? null : witnessContact?.trim() || null,
        reporter_name: isAnonymous ? null : reporterName?.trim() || null,
        reporter_contact: isAnonymous ? null : reporterContact?.trim() || null,
      };

      console.log("Submitting report data:", reportData);

      const result = await supabase
        .from("incident_reports")
        .insert([reportData])
        .select("id, report_code")
        .single();

      console.log("Insert response:", result);

      const { data: report, error } = result;

      if (error) {
        console.error("Insert error details:", error);
        throw new Error(error?.message || "Failed to create report");
      }

      if (!report) {
        throw new Error("No report was created");
      }

      const reportRecord = report;
      console.log("Report created:", reportRecord);

      // Handle file uploads
      let uploadedCount = 0;
      for (const file of files) {
        try {
          if (file.size > 25 * 1024 * 1024) {
            toast.warning(`Skipping ${file.name} — over 25 MB`);
            continue;
          }

          const hash = await sha256Hex(file);
          const meta = fileMetadata.get(file.name);
          const sanitizedName = file.name.replace(/[^\w.\-]/g, "_");
          const path = `${reportRecord.id}/${Date.now()}-${sanitizedName}`;

          // FIX #3: Improved error handling for file uploads
          const uploadResult = await supabase.storage
            .from("evidence")
            .upload(path, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });

          const { error: upErr } = uploadResult;
          if (upErr) {
            console.error("Upload error:", upErr);
            toast.warning(`Upload failed for ${file.name}: ${upErr.message}`);
            continue;
          }

          uploadedCount++;

          // Create evidence record
          try {
            const evResult = await supabase
              .from("report_evidence")
              .insert({
                report_id: reportRecord.id,
                storage_path: path,
                file_name: sanitizedName,
                content_type: file.type || "application/octet-stream",
                size_bytes: file.size,
                sha256: hash,
                gps_latitude: meta?.lat ?? null,
                gps_longitude: meta?.lon ?? null,
                gps_accuracy_meters: meta?.accuracy ?? null,
                media_timestamp: meta?.timestamp ?? null,
              })
              .select("id")
              .single();

            if (evResult.error) {
              console.warn(
                `Evidence record failed for ${file.name}:`,
                evResult.error,
              );
              toast.warning(
                `Evidence for ${file.name} uploaded but record failed`,
              );
            }
          } catch (evErr) {
            console.warn("Evidence record error:", evErr);
            toast.warning(
              `Evidence for ${file.name} uploaded but could not create record`,
            );
          }
        } catch (fileErr) {
          console.error("File processing error:", fileErr);
          toast.warning(`Could not process ${file.name}`);
        }
      }

      if (files.length > 0 && uploadedCount === 0) {
        toast.warning(
          "No files were uploaded successfully, but report was created",
        );
      } else if (uploadedCount > 0) {
        toast.success(
          `Report submitted with ${uploadedCount} file${uploadedCount !== 1 ? "s" : ""}`,
        );
      } else {
        toast.success(`Report submitted! Code: ${reportRecord.report_code}`);
      }

      setSubmitted({ code: reportRecord.report_code });
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      console.error("Submission error:", err);
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error details:", message);
      toast.error(`Could not submit: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="card-white p-10">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-display text-2xl font-bold">
            Your report has been received.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            It has been sealed with a tamper-evident timestamp and file hash.
            Our moderation team will review it before it contributes to
            aggregate statistics.
          </p>
          <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4">
            <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
              Reference number
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-wide">
              {submitted.code}
            </p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Save this reference number. Legal partners can use it when following
            up with you directly. Your report details are only visible to
            verified organisations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-full border-2 border-ink px-5 py-2.5 font-display text-sm font-semibold hover:bg-muted"
            >
              Return home
            </Link>
            <button
              onClick={() => {
                setSubmitted(null);
                setFiles([]);
                setConsent(false);
                setStep(1);
                setIncidentAt("");
                setLocationText("");
                setCity("");
                setIncidentType("");
                setDescription("");
                setInjuryDetails("");
                setBadgeOrUnit("");
                navigate({ to: "/report" });
              }}
              className="rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-ink-foreground hover:opacity-90"
            >
              File another report
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step shell ────────────────────────────────────────────────────────────
  return (
    <>
      <QuickExit />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>

        <p className="mb-2 font-display text-xs uppercase tracking-widest">
          <span className="highlight-lime">Incident report</span>
        </p>
        <h1 className="font-display text-3xl font-bold">File a report</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          All fields are private. You can submit anonymously. Optional fields
          can be left blank.
        </p>

        <div className="mt-8">
          <ProgressIndicator step={step} />
        </div>

        {/* ── Step 1: What happened ── */}
        {step === 1 && (
          <div className="card-white space-y-6 p-6 md:p-8">
            <h2 className="font-display text-lg font-bold">What happened</h2>

            <Field
              label="Date & time of incident"
              required
              error={errors.incident_at}
            >
              <Input
                type="datetime-local"
                value={incidentAt}
                onChange={(e) => setIncidentAt(e.target.value)}
                onBlur={() => validateField("incident_at", incidentAt)}
                aria-invalid={!!errors.incident_at}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Location"
                hint="Address, landmark, or coordinates"
                required
                error={errors.location_text}
              >
                <Input
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  onBlur={() => validateField("location_text", locationText)}
                  placeholder="e.g. Jantar Mantar, near Gate 3"
                  aria-invalid={!!errors.location_text}
                />
              </Field>
              <Field label="City / area" hint="Used only for aggregate maps">
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Delhi"
                />
              </Field>
            </div>

            <Field
              label="Incident type"
              hint="Helps categorize reports and identify patterns"
            >
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Describe the incident"
              required
              error={errors.description}
            >
              <Textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => validateField("description", description)}
                placeholder="What did you see or experience? Include what happened, who was involved, and any actions taken by officers."
                aria-invalid={!!errors.description}
              />
            </Field>

            <Field
              label="Injury details"
              hint="Any injuries you or others sustained (optional)"
            >
              <Textarea
                rows={3}
                value={injuryDetails}
                onChange={(e) => setInjuryDetails(e.target.value)}
                placeholder="Optional"
              />
            </Field>

            <Field
              label="Badge number or unit ID"
              hint="As reported — unverified. Never published publicly."
            >
              <Input
                value={badgeOrUnit}
                onChange={(e) => setBadgeOrUnit(e.target.value)}
                placeholder="e.g. Badge 4521 / Unit RAF-3"
              />
            </Field>
          </div>
        )}

        {/* ── Step 2: Evidence ── */}
        {step === 2 && (
          <div className="card-white space-y-6 p-6 md:p-8">
            <h2 className="font-display text-lg font-bold">Evidence upload</h2>
            <p className="text-sm text-muted-foreground">
              Upload any photos, video, or documents. This step is optional —
              you can skip it and still submit.
            </p>
            <UploadZone
              files={files}
              fileMetadata={fileMetadata}
              onFilesChange={setFiles}
            />
          </div>
        )}

        {/* ── Step 3: Contact / anonymous choice ── */}
        {step === 3 && (
          <div className="card-white space-y-6 p-6 md:p-8">
            <h2 className="font-display text-lg font-bold">
              Contact & privacy
            </h2>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-muted/50 has-[:checked]:border-ink">
                <Checkbox
                  className="mt-0.5"
                  checked={isAnonymous}
                  onCheckedChange={(v) => setIsAnonymous(!!v)}
                />
                <div>
                  <p className="font-display text-sm font-semibold">
                    Submit anonymously
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    No contact info will be stored or associated with your
                    report.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-muted/50 has-[:checked]:border-ink">
                <Checkbox
                  className="mt-0.5"
                  checked={isUrgent}
                  onCheckedChange={(v) => setIsUrgent(!!v)}
                />
                <div>
                  <p className="font-display text-sm font-semibold">
                    Mark as urgent
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    For ongoing incidents or where immediate legal assistance is
                    needed.
                  </p>
                </div>
              </label>
            </div>

            {!isAnonymous && (
              <>
                <div className="border-t border-border/60 pt-5">
                  <h3 className="mb-4 font-display text-sm font-bold">
                    Witness details (optional)
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Witness name">
                      <Input
                        value={witnessName}
                        onChange={(e) => setWitnessName(e.target.value)}
                      />
                    </Field>
                    <Field label="Witness contact">
                      <Input
                        value={witnessContact}
                        onChange={(e) => setWitnessContact(e.target.value)}
                        placeholder="Phone or email"
                      />
                    </Field>
                  </div>
                </div>
                <div className="border-t border-border/60 pt-5">
                  <h3 className="mb-1 font-display text-sm font-bold">
                    Your contact details (optional)
                  </h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Only used by legal aid for follow-up. Never made public.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name">
                      <Input
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                      />
                    </Field>
                    <Field label="Your contact">
                      <Input
                        value={reporterContact}
                        onChange={(e) => setReporterContact(e.target.value)}
                        placeholder="Phone or email"
                      />
                    </Field>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Review & submit ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="card-white p-6 md:p-8">
              <h2 className="mb-5 font-display text-lg font-bold">
                Review your report
              </h2>
              <dl className="space-y-3 text-sm">
                <ReviewRow
                  label="Date & time"
                  value={
                    incidentAt ? new Date(incidentAt).toLocaleString() : "—"
                  }
                />
                <ReviewRow label="Location" value={locationText || "—"} />
                {city && <ReviewRow label="City" value={city} />}
                {incidentType && (
                  <ReviewRow
                    label="Type"
                    value={
                      INCIDENT_TYPES.find((t) => t.value === incidentType)
                        ?.label ?? incidentType
                    }
                  />
                )}
                <ReviewRow label="Description" value={description} multiline />
                {injuryDetails && (
                  <ReviewRow label="Injuries" value={injuryDetails} multiline />
                )}
                {badgeOrUnit && (
                  <ReviewRow label="Badge / unit" value={badgeOrUnit} />
                )}
                <ReviewRow
                  label="Files attached"
                  value={files.length > 0 ? `${files.length} file(s)` : "None"}
                />
                <ReviewRow
                  label="Submission mode"
                  value={isAnonymous ? "Anonymous" : "Identified"}
                />
                {isUrgent && (
                  <ReviewRow label="Priority" value="Marked urgent" />
                )}
              </dl>
            </div>

            <div className="card-white p-6">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  className="mt-0.5"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(!!v)}
                />
                <span className="text-sm leading-relaxed">
                  I understand this report may be shared with legal aid
                  organisations and verified civil rights groups. In aggregate
                  and anonymised form, insights may be shared with journalists
                  and researchers. Identifying details about individual officers{" "}
                  <span className="highlight-lime">will not be published</span>{" "}
                  on this platform. I affirm this information is true to the
                  best of my knowledge.
                  <Link
                    to="/terms"
                    className="mt-2 block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Read our full terms of use
                  </Link>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={onSubmit}
                disabled={submitting || !consent}
                className="rounded-full bg-ink px-7 py-6 font-display text-base font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
              <p className="text-xs text-muted-foreground">
                {isAnonymous ? "Anonymous · " : ""}
                {isUrgent ? "Urgent · " : ""}A tamper-evident ID and timestamp
                will be created on submission.
              </p>
            </div>
          </div>
        )}

        {/* ── Step nav ── */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={backStep}
              className="inline-flex items-center gap-1 rounded-full border-2 border-ink px-5 py-2.5 font-display text-sm font-semibold hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
          ) : (
            <div />
          )}
          {step < 4 && (
            <button
              onClick={advanceStep}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 font-display text-sm font-semibold text-ink-foreground hover:opacity-90"
            >
              Continue <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 flex-shrink-0 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`flex-1 text-foreground ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
