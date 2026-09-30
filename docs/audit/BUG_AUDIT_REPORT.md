# 🐛 COMPREHENSIVE BUG AUDIT REPORT - Accountability Watch

## Critical Issues Found

### 1. **Report Submission Form: Missing VITE\_ Environment Variables**

**File:** `.env`
**Severity:** CRITICAL - Blocks frontend

The frontend uses `import.meta.env.VITE_*` but the .env file is missing:

- ✅ `VITE_SUPABASE_URL` exists
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` exists
- ✅ `VITE_SUPABASE_PROJECT_ID` exists
- ❌ **Missing:** Backend/server variables not exposed to frontend

**Impact:** Environment variable loading is working, but need to verify at runtime.

---

### 2. **RLS Policy Bug: Restrictive WITH CHECK(consent_given = true)**

**File:** `supabase/migrations/DEPLOY_ALL.sql` (line 89-91)
**Severity:** CRITICAL - Blocks anonymous report submission

```sql
CREATE POLICY "anyone can submit reports" ON public.incident_reports
  FOR INSERT TO anon, authenticated WITH CHECK (consent_given = true);
```

**Problem:** This policy requires `consent_given = true` in the INSERT statement itself, which means:

- Anonymous users cannot insert if they don't explicitly set this
- Frontend sends `consent_given: true` but policy still rejects (timing issue)
- Results in 401 errors

**Fix:** Change to `WITH CHECK (true)` and enforce via constraint instead.

---

### 3. **CORS Not Configured in Supabase**

**Severity:** CRITICAL - Blocks browser requests

Frontend running on `http://localhost:8080` but Supabase API doesn't allow this origin.

**Fix Needed:**

1. Go to Supabase Project Settings → API
2. Add allowed origin: `http://localhost:8080` and `http://localhost:*`

---

### 4. **Date Handling Bug in Report Form**

**File:** `src/routes/report.tsx` (line 370)
**Severity:** HIGH - Data corruption

```typescript
const reportData: Record<string, unknown> = {
  incident_at: new Date(incidentAt).toISOString(),  // ❌ BUG
  ...
};
```

**Problem:** `incidentAt` is from `<Input type="datetime-local">` which returns a string like `"2026-01-15T10:30"` (local timezone without Z). When passed to `new Date()`, it's interpreted as UTC, then converted back to ISO, causing timezone shift.

**Example:**

- User enters: `2026-01-15T10:30` (intent: 10:30 in their timezone, e.g. IST)
- Code does: `new Date("2026-01-15T10:30").toISOString()` → `"2026-01-15T05:00:00.000Z"` (5 hours earlier!)

**Fix:** Send timestamp as-is or add timezone info.

---

### 5. **File Upload Validation Missing from Frontend**

**File:** `src/routes/report.tsx` (line 192-220)
**Severity:** HIGH - Poor UX, server rejects anyway

File upload accepts `image/*,video/*,.pdf` but:

- No size check before upload (waits until submission)
- Backend validates and rejects >25MB with cryptic error
- User sees "Upload failed" but doesn't know why

**Fix:** Add frontend validation:

```typescript
if (file.size > 25 * 1024 * 1024) {
  toast.error(`${file.name} exceeds 25 MB limit`);
  return;
}
```

---

### 6. **Missing Error Handling for Evidence Upload Failures**

**File:** `src/routes/report.tsx` (line 410-418)
**Severity:** MEDIUM - Silent failures

```typescript
const { error: upErr } = await supabase.storage.from("evidence").upload(path, file, ...);
if (upErr) {
  toast.warning(`Upload failed for ${file.name}`);
  continue;  // ❌ Continues anyway, but evidence record not created
}
```

**Problem:** If file upload fails, no record is added to `report_evidence` table, causing orphaned storage files and missing evidence references.

**Fix:** Either:

1. Fail entire submission if evidence upload fails
2. Or: Mark evidence record with `upload_failed: true` status

---

### 7. **Race Condition: Evidence Metadata Lost**

**File:** `src/routes/report.tsx` (line 316)
**Severity:** MEDIUM - Data loss

```typescript
const [fileMetadata] = useState<Map<string, FileMeta>>(new Map());
```

The metadata map is declared in state but never persisted. If user navigates or the page reloads, metadata is lost.

**Fix:** Save metadata to `window.sessionStorage` or include in file object itself.

---

### 8. **No Validation on Witness/Reporter Contact**

**File:** `src/routes/report.tsx` (line 60-62, step 3)
**Severity:** MEDIUM - Garbage data

Contact fields accept any string (max 200 chars) but don't validate email/phone format.

**Fix:** Add phone/email validation to step3Schema.

---

### 9. **Missing Incident Timestamp Validation**

**File:** `src/routes/report.tsx` (step1Schema)
**Severity:** MEDIUM - Data quality

Incident date field has no constraint against future dates or dates > 1 year ago.

**Fix:** Add validation:

```typescript
incident_at: z.string()
  .min(1, "Date and time required")
  .refine(dt => {
    const d = new Date(dt);
    return d < new Date() && d > new Date(Date.now() - 365*24*60*60*1000);
  }, "Date must be recent (within 1 year)"),
```

---

### 10. **CSV Export Bug: Missing Comma in Summary Section**

**File:** `src/routes/dashboard.tsx` (line 105)
**Severity:** LOW - Output formatting

```typescript
lines.push("TOTAL_REPORTS", String(data.total_reports)); // ❌ Should be one string with comma
```

Should be:

```typescript
lines.push(`"TOTAL_REPORTS",${data.total_reports}`);
```

---

### 11. **PDF Export Filename Bug**

**File:** `src/routes/dashboard.tsx` (line 139)
**Severity:** LOW - File naming

Icon shows `FileJson` but exports PDF. Should be `FileText` or similar.

---

### 12. **Storage Policy Missing Read Permission for Admins**

**File:** `supabase/migrations/DEPLOY_ALL.sql` (storage policies)
**Severity:** HIGH - Admin can't view evidence

Storage policies only allow anonymous read on `evidence` bucket, but admins/legal partners can't download evidence files because there's no SELECT policy for authenticated users.

**Fix:** Add policy:

```sql
CREATE POLICY "admin_read_evidence" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'evidence' AND
    (SELECT EXISTS(SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'legal_partner')))
  );
```

---

### 13. **Quick Exit Button Hardcoded to weather.com**

**File:** `src/routes/report.tsx` (line 137)
**Severity:** MEDIUM - Security/UX

```typescript
onClick={() => { window.location.replace("https://weather.com"); }}
```

Hardcoded to external site. Should be:

- Configurable via environment variable
- Or list of safe domains (government, news sites, etc.)

---

### 14. **Missing Rate Limiting on Report Submission**

**Severity:** HIGH - Spam/DoS risk

Anonymous users can submit unlimited reports without rate limiting. No backpressure mechanism.

**Fix:**

1. Add IP-based rate limiting in Supabase row-level security
2. Or: Add client-side cooldown (localStorage key with timestamp)

---

### 15. **Admin Route: Secondary Gate is Inefficient**

**File:** `src/routes/_authenticated/route.tsx` (line 26-31)
**Severity:** LOW - Minor performance

Makes extra DB query after auth check. Could batch with auth.getUser() call.

---

### 16. **No Soft Delete for Reports**

**Severity:** MEDIUM - Audit trail

Admins can hard-delete reports (`DELETE` policy exists) with no audit log retention.

**Fix:**

1. Add `deleted_at` timestamp column
2. Use soft delete (set `deleted_at` instead of `DELETE`)
3. Keep record for audit purposes

---

### 17. **Missing Database Constraints on Evidence Table**

**File:** `supabase/migrations/DEPLOY_ALL.sql` (report_evidence table)
**Severity:** MEDIUM - Data integrity

No constraint preventing empty or suspicious hashes:

```sql
sha256 text NOT NULL,  -- ❌ No length check, format validation
```

**Fix:** Add constraint:

```sql
CONSTRAINT chk_sha256_format CHECK (length(sha256) = 64 AND sha256 ~ '^[a-f0-9]{64}$'),
```

---

### 18. **Missing Indexes for Common Queries**

**Severity:** MEDIUM - Performance

Dashboard query filters by city, but index only exists on `created_at`.

Missing indexes:

- `incident_reports(city, created_at DESC)` - for dashboard queries
- `report_evidence(report_id, created_at DESC)` - for evidence listing

---

### 19. **Form State Not Reset on Step Back**

**File:** `src/routes/report.tsx` (line 353-357)
**Severity:** LOW - UX issue

When navigating back to Step 1, all form data persists. If user changes fields and goes back, old data is still there, causing confusion.

**Fix:** Optional — clear step data on back navigation, or add "Clear form" button.

---

### 20. **Missing Loading State on CSV/PDF Export**

**File:** `src/routes/dashboard.tsx` (exportCSV, exportPDF)
**Severity:** LOW - UX

Buttons don't show loading state while processing, users might click multiple times.

---

## Summary

| Severity | Count | Status         |
| -------- | ----- | -------------- |
| CRITICAL | 4     | 🔴 Must fix    |
| HIGH     | 6     | 🟠 Must fix    |
| MEDIUM   | 8     | 🟡 Should fix  |
| LOW      | 2     | 🟢 Nice to fix |

**Critical path to working submission:**

1. ✅ Fix RLS policies (WITH CHECK true)
2. ✅ Configure CORS in Supabase
3. ✅ Fix timezone bug in date handling
4. ✅ Add frontend file validation
5. ✅ Fix storage policies for admin read access
