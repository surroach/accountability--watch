import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
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
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { z } from "zod";
import * as exifr from "exifr";

// F3: Detect if using mock backend (local in-memory service)
function isUsingMockBackend(): boolean {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  // If no Supabase URL or key configured, using mock backend
  return !supabaseUrl || !supabaseKey || supabaseUrl === "" || supabaseKey === "";
}

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
      // Parse datetime-local as local browser time, not UTC
      const d = new Date(dt);
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

/**
 * Get user's browser timezone offset in hours
 */
function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset() / 60;
}

/**
 * Get browser timezone name (e.g., "Asia/Kolkata")
 * Fallback to UTC offset if Intl API unavailable
 */
function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    const offset = getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const hours = Math.abs(Math.floor(offset));
    const minutes = Math.abs((offset * 60) % 60);
    return `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
  }
}

/**
 * Convert datetime-local string (browser time) to ISO 8601 UTC string
 * datetime-local format: "2024-01-15T14:30"
 * Returns ISO: "2024-01-15T09:00:00Z" (if timezone is UTC+5:30)
 */
function datetimeLocalToISO(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  const d = new Date(datetimeLocal);
  return d.toISOString();
}

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
    <nav aria-label="Report submission progress" className="mb-8">
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
                  aria-label={`Step ${s.number}: ${s.label}${done ? " (completed)" : active ? " (current)" : ""}`}
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

// ── Breadcrumb navigation ─────────────────────────────────────────────────────
function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {item.href ? (
              <>
                <Link
                  to={item.href}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1"
                >
                  {item.label}
                </Link>
                {idx < items.length - 1 && (
                  <ChevronRight 
                    className="h-4 w-4 text-muted-foreground flex-shrink-0" 
                    aria-hidden="true"
                  />
                )}
              </>
            ) : (
              <>
                <span 
                  className="text-foreground font-medium"
                  aria-current="page"
                >
                  {item.label}
                </span>
              </>
            )}
          </li>
        ))}
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
  id,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const errorId = id ? `${id}-error` : undefined;
  const hintId = id ? `${id}-hint` : undefined;
  
  return (
    <div>
      <Label 
        htmlFor={id}
        className="font-display text-sm font-semibold flex items-center gap-1"
      >
        {label}
        {required && (
          <span 
            className="ml-0.5 text-destructive font-bold" 
            aria-label="required"
            title="This field is required"
          >
            *
          </span>
        )}
      </Label>
      <div className="mt-2">{children}</div>
      {error ? (
        <div 
          id={errorId}
          className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 border border-destructive/30"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      ) : (
        hint && (
          <p 
            id={hintId}
            className="mt-1.5 text-xs text-muted-foreground"
          >
            {hint}
          </p>
        )
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
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  // F1: Generate unique key for file (name + size + lastModified to handle true duplicates)
  function getFileKey(file: File): string {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }

  async function addFiles(incoming: File[]) {
    const next = [...files];
    const errors: string[] = [];
    
    for (const f of incoming) {
      // F1: 25 MB per-file limit (established in current code)
      if (f.size > 25 * 1024 * 1024) {
        errors.push(`${f.name} exceeds 25 MB limit`);
        continue;
      }
      
      // Validate file type
      const allowedTypes = ['image/', 'video/', 'application/pdf'];
      const isAllowed = allowedTypes.some(type => f.type.startsWith(type));
      if (!isAllowed) {
        errors.push(`${f.name} has unsupported file type`);
        continue;
      }
      
      // F1: Check for duplicates using unique key (name + size + lastModified), not just filename
      const fileKey = getFileKey(f);
      if (!next.find((x) => getFileKey(x) === fileKey)) {
        next.push(f);
      } else {
        errors.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB) is already added`);
      }
    }
    
    if (errors.length > 0) {
      setUploadErrors(errors);
      if (errors.length === incoming.length) {
        toast.error("No valid files to add. Check the errors below.");
      } else {
        toast.warning(`${incoming.length - errors.length} file(s) added with ${errors.length} error(s).`);
      }
    } else {
      setUploadErrors([]);
    }
    
    onFilesChange(next);
    
    // F1: Extract metadata from newly added files
    for (const f of next.filter(file => !files.find(x => getFileKey(x) === getFileKey(file)))) {
      if (f.size > 25 * 1024 * 1024) continue;
      const meta = await extractFileMeta(f);
      if (meta) {
        // F1: Use unique key for metadata map as well
        fileMetadata.set(getFileKey(f), meta);
      }
    }
    
    // F2: Explain that metadata may contain sensitive information
    if (next.some(f => fileMetadata.has(getFileKey(f)))) {
      toast.info(
        "GPS and timestamp metadata detected in some files. This metadata may contain sensitive location or timing information and will be included with your submission for verification purposes.",
      );
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [files, fileMetadata],
  );

  function removeFile(idx: number) {
    const removedFile = files[idx];
    const removedUrl = previewUrl(removedFile);
    
    // F1: Revoke preview URL on removal
    if (removedUrl) {
      URL.revokeObjectURL(removedUrl);
      previewUrlsRef.current.delete(removedUrl);
    }
    
    const next = files.filter((_, i) => i !== idx);
    onFilesChange(next);
    
    // F1: Use unique key for metadata cleanup
    fileMetadata.delete(getFileKey(removedFile));
  }

  function previewUrl(f: File): string | null {
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      previewUrlsRef.current.add(url);
      return url;
    }
    return null;
  }

  // F1: Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  function clearErrors() {
    setUploadErrors([]);
  }

  // F1: Handle Space key on upload control for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

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
        aria-label="Upload evidence — drag files here or click to browse. Photos, video, or PDF. Maximum 25 MB per file."
        onKeyDown={handleKeyDown}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink transition-colors duration-200
          ${dragging ? "border-ink bg-lime/20" : "border-ink/30 bg-muted/40 hover:border-ink hover:bg-muted/60"}`}
      >
        <Upload className="mb-2 sm:mb-3 h-7 sm:h-8 w-7 sm:w-8 text-muted-foreground" aria-hidden="true" />
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
          aria-label="Select evidence files to upload"
        />
      </div>

      {uploadErrors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-sm text-destructive font-medium">File upload errors:</p>
            <button
              onClick={clearErrors}
              className="text-destructive hover:text-destructive/80 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-destructive rounded px-1 transition-colors"
              aria-label="Dismiss errors"
            >
              Dismiss
            </button>
          </div>
          <ul className="text-xs text-destructive space-y-1">
            {uploadErrors.map((err, idx) => (
              <li key={idx}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files for evidence">
          {files.map((f, i) => {
            const url = previewUrl(f);
            const fileKey = getFileKey(f);
            const meta = fileMetadata.get(fileKey);
            // F2: Fix zero-coordinate bug - check for "!== undefined" not just truthiness
            const hasGPS = meta?.lat !== undefined && meta?.lon !== undefined;
            
            return (
              <li
                key={fileKey}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
              >
                {url ? (
                  <img
                    src={url}
                    alt={f.name}
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground font-mono">
                    {f.name.split(".").pop()?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  {meta && (
                    <div className="mt-1 space-y-0.5">
                      {hasGPS && (
                        <p className="flex items-center gap-1 text-xs text-foreground/70">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          GPS: {meta.lat!.toFixed(4)}°, {meta.lon!.toFixed(4)}°
                          <span className="text-muted-foreground text-xs">(sensitive)</span>
                        </p>
                      )}
                      {meta.timestamp && (
                        <p className="flex items-center gap-1 text-xs text-foreground/70">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          Taken: {new Date(meta.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="flex-shrink-0 rounded p-1 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink transition-colors duration-200"
                  aria-label={`Remove file: ${f.name}`}
                  title="Remove this file"
                >
                  <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
  const [previewUrls, setPreviewUrls] = useState<Set<string>>(new Set());

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

  // E5: Complete reset function
  function resetForm() {
    // Revoke all preview URLs (E5)
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls(new Set());
    
    // Reset all form state
    setIncidentAt("");
    setLocationText("");
    setCity("");
    setIncidentType("");
    setDescription("");
    setInjuryDetails("");
    setBadgeOrUnit("");
    
    setFiles([]);
    fileMetadata.clear();
    
    setIsAnonymous(false);
    setIsUrgent(false);
    setWitnessName("");
    setWitnessContact("");
    setReporterName("");
    setReporterContact("");
    
    setConsent(false);
    setErrors({});
    setSubmitting(false);
    setSubmitted(null);
    setStep(1);
    setHasUnsavedChanges(false);
  }

  // E6: Track unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges && !submitted) {
        e.preventDefault();
        e.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, submitted]);

  // E6: Update unsaved changes flag when form data changes
  useEffect(() => {
    const hasData =
      incidentAt ||
      locationText ||
      city ||
      description ||
      injuryDetails ||
      badgeOrUnit ||
      witnessName ||
      witnessContact ||
      reporterName ||
      reporterContact ||
      files.length > 0 ||
      isAnonymous ||
      isUrgent;
    
    setHasUnsavedChanges(hasData && !submitted);
  }, [
    incidentAt,
    locationText,
    city,
    description,
    injuryDetails,
    badgeOrUnit,
    witnessName,
    witnessContact,
    reporterName,
    reporterContact,
    files.length,
    isAnonymous,
    isUrgent,
    submitted,
  ]);

  // E3: Focus step heading when step changes
  useEffect(() => {
    if (stepHeadingRef.current) {
      stepHeadingRef.current.focus();
      stepHeadingRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step]);

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
    
    // E3: Focus first invalid field
    const firstErrorField = Object.keys(errs)[0];
    if (firstErrorField) {
      const fieldEl = document.getElementById(firstErrorField);
      if (fieldEl) {
        fieldEl.focus();
        fieldEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    
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
    // E4: When switching from anonymous to identified, don't block on contact field errors if they're empty
    if (step === 3 && isAnonymous) {
      // Skip contact validation in anonymous mode
      setStep((s) => Math.min(s + 1, 4));
      window.scrollTo({ top: 0, behavior: "instant" });
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
    const step1Result = step1Schema.safeParse({
      incident_at: incidentAt,
      location_text: locationText,
      city,
      incident_type: incidentType,
      description,
      injury_details: injuryDetails,
      badge_or_unit: badgeOrUnit,
    });
    
    if (!step1Result.success) {
      toast.error("Please fill in all required fields correctly");
      const errs: FieldErrors = {};
      for (const issue of step1Result.error.issues) {
        const key = issue.path[0] as string;
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      setStep(1);
      return;
    }

    // E4: Only validate contact fields if not anonymous or if contact fields have been filled
    if (!isAnonymous) {
      const step3Result = step3Schema.safeParse({
        witness_name: witnessName,
        witness_contact: witnessContact,
        reporter_name: reporterName,
        reporter_contact: reporterContact,
      });
      
      if (!step3Result.success) {
        // Only show error if there were validation issues (not just optional fields being empty)
        const hasValidationErrors = step3Result.error.issues.some(
          issue => issue.code !== "too_big" && issue.code !== "too_small"
        );
        if (hasValidationErrors) {
          toast.error("Please correct the contact information");
          setStep(3);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // E1: Convert datetime-local (browser time) to ISO timestamp correctly
      if (!incidentAt) throw new Error("Date and time are required");

      const incidentDate = datetimeLocalToISO(incidentAt);

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

      // F3: Insert report and check for submission success
      const { data: report, error } = await supabase
        .from("reports")
        .insert([reportData])
        .select("id, report_code")
        .single();

      if (error) {
        // F4: Keep useful error messages without exposing sensitive details
        if (error.message?.includes("duplicate")) {
          throw new Error("A report with similar details was recently submitted. Please check if your report is already recorded before submitting again.");
        }
        if (error.message?.includes("connection") || error.message?.includes("timeout")) {
          throw new Error("Network error. Please check your connection and try again.");
        }
        throw new Error(error?.message || "Failed to create report");
      }

      if (!report) {
        throw new Error("No report was created");
      }

      const reportRecord = report;

      // Handle file uploads
      let uploadedCount = 0;
      let uploadErrors: string[] = [];
      
      for (const file of files) {
        try {
          if (file.size > 25 * 1024 * 1024) {
            uploadErrors.push(`${file.name} exceeds 25 MB limit`);
            continue;
          }

          const hash = await sha256Hex(file);
          const fileKey = `${file.name}|${file.size}|${file.lastModified}`;
          const meta = fileMetadata.get(fileKey);
          const sanitizedName = file.name.replace(/[^\w.\-]/g, "_");
          const path = `${reportRecord.id}/${Date.now()}-${sanitizedName}`;

          // Improved error handling for file uploads
          const uploadResult = await supabase.storage
            .from("evidence")
            .upload(path, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });

          const { error: upErr } = uploadResult;
          if (upErr) {
            // F4: Show user-friendly error without exposing sensitive details
            if (upErr.message?.includes("quota")) {
              uploadErrors.push(`${file.name}: Storage quota exceeded`);
            } else if (upErr.message?.includes("unauthorized")) {
              uploadErrors.push(`${file.name}: Permission denied`);
            } else {
              uploadErrors.push(`${file.name}: Upload failed`);
            }
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
              // F4: Log errors without exposing file details
              uploadErrors.push(
                `Evidence for ${file.name} uploaded but metadata record could not be saved`,
              );
            }
          } catch (evErr) {
            // F4: Keep error handling without exposing sensitive details
            uploadErrors.push(
              `Evidence for ${file.name} uploaded but metadata could not be saved`,
            );
          }
        } catch (fileErr) {
          // F4: Handle errors gracefully
          const msg = fileErr instanceof Error ? "Upload processing failed" : "Upload processing failed";
          uploadErrors.push(`${file.name}: ${msg}`);
        }
      }

      // F3: Report success with file status (show exactly which files failed without exposing details)
      if (uploadErrors.length > 0) {
        if (uploadedCount > 0) {
          toast.success(
            `Report submitted! ${uploadedCount} of ${files.length} file${files.length !== 1 ? "s" : ""} uploaded. Reference: ${reportRecord.report_code}`
          );
        } else if (files.length > 0) {
          toast.warning(`Report submitted, but file uploads failed. Reference: ${reportRecord.report_code}. You can retry uploading files later.`);
        } else {
          toast.success(`Report submitted! Reference: ${reportRecord.report_code}`);
        }
      } else if (files.length > 0) {
        toast.success(
          `Report submitted with ${uploadedCount} file${uploadedCount !== 1 ? "s" : ""}. Reference: ${reportRecord.report_code}`
        );
      } else {
        toast.success(`Report submitted! Reference: ${reportRecord.report_code}`);
      }

      // E5: Mark submission complete so unsaved warning doesn't appear
      setSubmitted({ code: reportRecord.report_code });
      setHasUnsavedChanges(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      // F4: Keep error handling without exposing sensitive details
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(`Could not submit: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (submitted) {
    const isMock = isUsingMockBackend();
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-5 py-12 sm:py-16">
        {isMock && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-amber-900 mb-1">
              ⚠ Demonstration Mode
            </p>
            <p className="text-xs text-amber-800">
              This is a working prototype with a local-only demo backend. Reports are not actually submitted to a production service.
            </p>
          </div>
        )}
        <div className="card-white p-6 sm:p-10">
          <div className="mb-4 sm:mb-5 inline-flex h-11 sm:h-12 w-11 sm:w-12 items-center justify-center rounded-2xl bg-lime">
            <ShieldCheck className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden />
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold">
            {isMock ? "Demo report processed." : "Your report has been received."}
          </h1>
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
            {isMock
              ? "This is a test submission in demonstration mode. No data has been submitted to a real service."
              : "It has been sealed with a tamper-evident timestamp and file hash. Our moderation team will review it before it contributes to aggregate statistics."
            }
          </p>
          <div className="mt-4 sm:mt-6 rounded-xl border border-border/60 bg-muted/40 p-3 sm:p-4">
            <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
              {isMock ? "Demo reference number" : "Reference number"}
            </p>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold tracking-wide break-all">
              {submitted.code}
            </p>
          </div>
          <p className="mt-3 sm:mt-4 text-xs text-muted-foreground">
            {isMock
              ? "In production, you would save this reference number for follow-up with legal partners."
              : "Save this reference number. Legal partners can use it when following up with you directly. Your report details are only visible to verified organisations."
            }
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full border-2 border-ink px-5 py-3 sm:py-2.5 font-display text-sm font-semibold transition-colors duration-200 hover:bg-lime focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              Return home
            </Link>
            <button
              onClick={() => {
                resetForm();
                navigate({ to: "/report" });
              }}
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 sm:py-2.5 font-display text-sm font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
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
      {isUsingMockBackend() && (
        <div className="sticky top-0 z-40 w-full bg-amber-50 border-b border-amber-200 px-4 sm:px-5 py-3">
          <div className="mx-auto max-w-2xl flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs sm:text-sm text-amber-900">
              <p className="font-semibold mb-0.5">Demonstration Mode</p>
              <p>This is a working prototype with a local backend for testing. Reports submitted here are not sent to a real service. For production use, configure Supabase credentials in your environment.</p>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-2xl px-4 sm:px-5 py-8 sm:py-10">
        <Breadcrumb 
          items={[
            { label: "Home", href: "/" },
            { label: "Report an incident" }
          ]}
        />

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
          <div className="card-white space-y-5 p-5 sm:p-6 md:p-8">
            <h2 
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink rounded px-1"
            >
              What happened
            </h2>

            <Field
              label="Date & time of incident"
              hint={`Your time zone: ${getBrowserTimezone()}`}
              required
              error={errors.incident_at}
              id="incident_at"
            >
              <Input
                id="incident_at"
                type="datetime-local"
                value={incidentAt}
                onChange={(e) => {
                  setIncidentAt(e.target.value);
                }}
                onBlur={() => validateField("incident_at", incidentAt)}
                aria-invalid={!!errors.incident_at}
                aria-describedby={errors.incident_at ? "incident_at-error" : "incident_at-hint"}
                className={errors.incident_at ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </Field>

            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
              <Field
                label="Location"
                hint="Address, landmark, or coordinates"
                required
                error={errors.location_text}
                id="location_text"
              >
                <Input
                  id="location_text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  onBlur={() => validateField("location_text", locationText)}
                  placeholder="e.g. Jantar Mantar, near Gate 3"
                  aria-invalid={!!errors.location_text}
                  aria-describedby={errors.location_text ? "location_text-error" : "location_text-hint"}
                  className={errors.location_text ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </Field>
              <Field 
                label="City / area" 
                hint="Used only for aggregate maps"
                id="city"
              >
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Delhi"
                  aria-describedby="city-hint"
                />
              </Field>
            </div>

            <Field
              label="Incident type"
              hint="Helps categorize reports and identify patterns"
              id="incident_type"
            >
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger id="incident_type" className="h-11 sm:h-10">
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
              id="description"
            >
              <Textarea
                id="description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => validateField("description", description)}
                placeholder="What did you see or experience? Include what happened, who was involved, and any actions taken by officers."
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "description-error" : "description-hint"}
                className={`${errors.description ? "border-destructive focus-visible:ring-destructive" : ""} text-base`}
              />
            </Field>

            <Field
              label="Injury details"
              hint="Any injuries you or others sustained (optional)"
              id="injury_details"
            >
              <Textarea
                id="injury_details"
                rows={3}
                value={injuryDetails}
                onChange={(e) => setInjuryDetails(e.target.value)}
                placeholder="Optional"
                aria-describedby="injury_details-hint"
                className="text-base"
              />
            </Field>

            <Field
              label="Badge number or unit ID"
              hint="As reported — unverified. Never published publicly."
              id="badge_or_unit"
            >
              <Input
                id="badge_or_unit"
                value={badgeOrUnit}
                onChange={(e) => setBadgeOrUnit(e.target.value)}
                placeholder="e.g. Badge 4521 / Unit RAF-3"
                aria-describedby="badge_or_unit-hint"
              />
            </Field>
          </div>
        )}

        {/* ── Step 2: Evidence ── */}
        {step === 2 && (
          <div className="card-white space-y-5 p-5 sm:p-6 md:p-8">
            <h2 
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink rounded px-1"
            >
              Evidence upload
            </h2>
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
          <div className="card-white space-y-5 p-5 sm:p-6 md:p-8">
            <h2 
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink rounded px-1"
            >
              Contact & privacy
            </h2>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 sm:p-4 hover:bg-muted/50 has-[:checked]:border-ink">
                <Checkbox
                  className="mt-1 sm:mt-0.5 h-5 w-5 sm:h-4 sm:w-4"
                  checked={isAnonymous}
                  onCheckedChange={(v) => setIsAnonymous(!!v)}
                  aria-label="Submit anonymously"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-semibold">
                    Submit anonymously
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    No contact info will be stored or associated with your
                    report.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 sm:p-4 hover:bg-muted/50 has-[:checked]:border-ink">
                <Checkbox
                  className="mt-1 sm:mt-0.5 h-5 w-5 sm:h-4 sm:w-4"
                  checked={isUrgent}
                  onCheckedChange={(v) => setIsUrgent(!!v)}
                  aria-label="Mark as urgent"
                />
                <div className="flex-1 min-w-0">
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
                  <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                    <Field 
                      label="Witness name"
                      id="witness_name"
                    >
                      <Input
                        id="witness_name"
                        value={witnessName}
                        onChange={(e) => setWitnessName(e.target.value)}
                        aria-describedby="witness_name-hint"
                        className="text-base sm:text-sm"
                      />
                    </Field>
                    <Field 
                      label="Witness contact"
                      hint="Phone or email"
                      id="witness_contact"
                    >
                      <Input
                        id="witness_contact"
                        value={witnessContact}
                        onChange={(e) => setWitnessContact(e.target.value)}
                        placeholder="Phone or email"
                        aria-describedby="witness_contact-hint"
                        className="text-base sm:text-sm"
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
                  <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                    <Field 
                      label="Your name"
                      id="reporter_name"
                    >
                      <Input
                        id="reporter_name"
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        aria-describedby="reporter_name-hint"
                        className="text-base sm:text-sm"
                      />
                    </Field>
                    <Field 
                      label="Your contact"
                      hint="Phone or email"
                      id="reporter_contact"
                    >
                      <Input
                        id="reporter_contact"
                        value={reporterContact}
                        onChange={(e) => setReporterContact(e.target.value)}
                        placeholder="Phone or email"
                        aria-describedby="reporter_contact-hint"
                        className="text-base sm:text-sm"
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
            <div className="card-white p-5 sm:p-6 md:p-8">
              <h2 
                ref={stepHeadingRef}
                tabIndex={-1}
                className="mb-4 sm:mb-5 font-display text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink rounded px-1"
              >
                Review your report
              </h2>
              <dl className="space-y-3 text-xs sm:text-sm">
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

            <div className="card-white p-5 sm:p-6">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  className="mt-1 sm:mt-0.5 h-5 w-5 sm:h-4 sm:w-4"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(!!v)}
                  aria-label="Consent to terms"
                />
                <span className="text-xs sm:text-sm leading-relaxed">
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

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
              <Button
                type="button"
                onClick={onSubmit}
                disabled={submitting || !consent}
                className="w-full sm:w-auto rounded-full bg-ink px-6 sm:px-7 py-3 sm:py-2.5 font-display text-sm sm:text-base font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : isUsingMockBackend() ? "Submit demo report" : "Submit report"}
              </Button>
              <p className="text-xs text-muted-foreground">
                {isUsingMockBackend() && "Demo · "}
                {isAnonymous ? "Anonymous · " : ""}
                {isUrgent ? "Urgent · " : ""}
                {isUsingMockBackend() ? "Test only" : "A tamper-evident ID and timestamp will be created on submission."}
              </p>
            </div>
          </div>
        )}

        {/* ── Step nav ── */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {step > 1 ? (
            <button
              onClick={backStep}
              className="inline-flex items-center justify-center gap-1 rounded-full border-2 border-ink px-5 py-3 sm:py-2.5 font-display text-sm font-semibold transition-colors duration-200 hover:bg-lime focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              aria-label="Go to previous step"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </button>
          ) : (
            <div />
          )}
          {step < 4 && (
            <button
              onClick={advanceStep}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 sm:py-2.5 font-display text-sm font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              aria-label="Go to next step"
            >
              Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt className="mb-1 sm:mb-0 sm:w-32 sm:flex-shrink-0 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`flex-1 text-foreground text-xs sm:text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
