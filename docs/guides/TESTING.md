# 🧪 COMPREHENSIVE TESTING & VALIDATION GUIDE

## Phase 1: Database & Backend Setup (Supabase)

### ✅ Execute SQL Fixes
**File:** `FIX_ALL_CRITICAL.sql`

Steps:
1. Go to https://app.supabase.com/project/mtholttdmrjptulqcfyk/sql
2. Paste entire contents of `FIX_ALL_CRITICAL.sql`
3. Click "Run" button
4. Verify no errors in output
5. Check status: Should see "Query executed successfully"

### ✅ Configure CORS
**URL:** https://app.supabase.com/project/mtholttdmrjptulqcfyk/settings/api

1. Scroll to "CORS" section
2. Add allowed origins:
   - `http://localhost:8080`
   - `http://localhost:*`
3. Click "Add"
4. Verify both appear in the list
5. Changes take effect immediately

### ✅ Verify Storage Bucket
**URL:** https://app.supabase.com/project/mtholttdmrjptulqcfyk/storage/buckets

1. Click "evidence" bucket
2. Verify it exists and is listed as "Public"
3. Check that policies are set to read/write public
4. No special auth required for initial test

---

## Phase 2: Frontend Build & Configuration

### ✅ Updated Files
- ✅ `src/routes/report.tsx` - Fixed 5 bugs:
  1. Timezone bug in date handling (line 371)
  2. File size validation on frontend (line 192)
  3. Evidence upload error handling (line 410)
  4. Quick exit URL configurability (line 127)
  5. Contact field validation + incident date validation

- ✅ `src/routes/dashboard.tsx` - Fixed CSV export bug (line 105)

- ✅ `.env` - Added `VITE_QUICK_EXIT_URL` configuration

### ✅ Build Verification
```bash
cd /path/to/accountability-watch
npm run build
# Expected: "✓ built in X.XXs" (no errors)
```

Completed ✅ - Build succeeded without errors.

---

## Phase 3: Manual Testing Checklist

### Test 1: Anonymous Report Submission
**Goal:** Verify basic form submission works end-to-end

1. Navigate to `http://localhost:8080/report`
2. Fill Step 1 (What happened):
   - Date & time: Today, 2:00 PM
   - Location: "Test location for verification"
   - City: "Test City"
   - Incident type: "Excessive Force"
   - Description: "This is a test report with sufficient detail to pass validation"
   - Leave injury/badge fields blank
3. Click Continue
4. Step 2 (Evidence):
   - Upload a small test image (or skip)
   - Click Continue
5. Step 3 (Contact & Privacy):
   - **Check** "Submit anonymously"
   - **Uncheck** "Mark as urgent"
   - Leave witness/reporter fields blank
   - Click Continue
6. Step 4 (Review & Submit):
   - **Check** consent checkbox
   - Click "Submit report"
7. **Expected outcome:**
   - Page shows success screen with report code (e.g., "AW-XYZABC123")
   - Confirmation: "Your report has been received"
   - Buttons to return home or file another report
8. **Failure mode:** If get "Could not submit. Please try again", check:
   - Browser console for 401/403 errors
   - Supabase SQL fixes were applied
   - CORS was configured
   - Dev server running on port 8080

---

### Test 2: Identified Report Submission
**Goal:** Verify form with contact info works

1. Navigate to `http://localhost:8080/report`
2. Fill Step 1 as before
3. Step 2: Skip files
4. Step 3 (Contact & Privacy):
   - **Uncheck** "Submit anonymously"
   - Witness name: "Jane Smith"
   - Witness contact: "jane@example.com"
   - Reporter name: "John Doe"
   - Reporter contact: "555-1234"
5. Continue to Step 4
6. Check consent and submit
7. **Expected outcome:** Success screen with report code

---

### Test 3: File Upload & Metadata
**Goal:** Verify file handling and EXIF extraction

1. Navigate to `/report`
2. Step 2 (Evidence):
   - Try uploading a file > 25 MB
   - **Expected:** Toast error: "exceeds 25 MB limit"
   - File NOT added to list
3. Upload a valid file (<25 MB)
   - **Expected:** File appears in list with:
     - Thumbnail (if image)
     - File size
     - Delete button works
4. Complete submission
5. **Backend verification:** Later, admin can see file hash and metadata

---

### Test 4: Form Validation
**Goal:** Verify client-side validation works

1. Step 1 (What happened):
   - Leave date/time empty
   - Click Continue
   - **Expected:** Error message: "Date and time are required"
2. Fill date, leave location empty
   - **Expected:** Error message: "Location is required"
3. Fill location with < 10 characters for description
   - **Expected:** Error: "at least 10 characters"
4. Incident date > 1 year in future
   - **Expected:** Error: "within the last year"
5. Step 3 (Contact):
   - Enter witness contact with invalid email
   - **Expected:** Error: "valid email or phone number"

---

### Test 5: Dashboard (Public)
**Goal:** Verify aggregate data display

1. Navigate to `http://localhost:8080/dashboard`
2. Should see:
   - "Total reports" stat (count of submitted reports)
   - "By city" table (aggregated by city)
   - "By month" bar chart
   - Export CSV button
   - Export PDF button
3. Try filters:
   - Enter city name in "City contains" field
   - Click refresh or set date range
   - **Expected:** Stats update
4. **Export CSV:**
   - Click "Export CSV"
   - Save file
   - Open in Excel/Google Sheets
   - **Expected:** CSV with headers: CITY,COUNT / MONTH,COUNT / TOTAL_REPORTS
5. **Export PDF:**
   - Click "Export PDF"
   - **Expected:** PDF downloads with chart and metadata

---

### Test 6: Admin Panel
**Goal:** Verify admin access and report viewing

**Prerequisites:**
- Create a Supabase user account
- Add row to `user_roles` table manually:
  ```sql
  INSERT INTO public.user_roles (user_id, role) 
  VALUES ('USER_ID_HERE', 'admin');
  ```

1. Navigate to `http://localhost:8080/auth`
2. Sign in with created user
3. Should redirect to `/admin`
4. **Expected dashboard:**
   - Table of all reports
   - Report codes, incident dates, cities, statuses
   - Search & filter by status
   - "View" button for each report
5. Click "View" on a report
   - **Expected:** Modal with:
     - Full report details
     - Evidence list with SHA-256 hashes
     - GPS coordinates & timestamps (if present)
     - Download button for each file
6. Try status update:
   - Change status from "New" to "Under Review"
   - **Expected:** Status updates in table
7. Export CSV:
   - Click "Export CSV"
   - **Expected:** CSV with all report fields

---

### Test 7: Moderation Queue
**Goal:** Verify moderation flow

**Prerequisites:**
- Add user with `legal_partner` role:
  ```sql
  INSERT INTO public.user_roles (user_id, role) 
  VALUES ('USER_ID_HERE', 'legal_partner');
  ```

1. Sign in as legal partner
2. Navigate to `/admin/moderation` or via sidebar
3. **Expected:**
   - Queue of reports with status "pending_moderation"
   - "Urgent only" filter checkbox
   - List shows: code, location, brief description, submission date
4. Click a report to open
5. **Expected modal:**
   - "Approve" and "Reject" buttons (only if pending)
   - Full details displayed
6. Click "Approve"
   - **Expected:** Report marked "moderation_approved"
   - Modal closes
   - Report disappears from queue
7. Go back to dashboard
   - Report should now be visible in aggregate stats

---

### Test 8: Error Handling & Edge Cases
**Goal:** Verify error messages are helpful

1. **Network error:**
   - Start report submission
   - Kill network (dev tools or unplug)
   - Try to submit
   - **Expected:** Error toast: "Could not submit. Please try again"
2. **Large file:**
   - Try upload file > 25 MB
   - **Expected:** Toast error before submission attempt
3. **Missing consent:**
   - Step 4 (Review), don't check consent box
   - Click "Submit report"
   - **Expected:** Toast error: "Please confirm the consent statement"
4. **Quick exit:**
   - In report form, click "Quick Exit" button
   - **Expected:** Redirects to `https://www.wikipedia.org` (or configured URL)

---

## Phase 4: Database Verification

### ✅ Run Verification Queries

In Supabase SQL Editor, run these to confirm all fixes applied:

```sql
-- Check RLS policies
SELECT * FROM pg_policies 
  WHERE tablename IN ('incident_reports', 'report_evidence') 
  ORDER BY tablename, policyname;
-- Should see: allow_anon_insert_reports, allow_anon_insert_evidence, admin_view_reports, allow_anon_read_evidence, allow_admin_read_evidence

-- Check storage policies
SELECT * FROM pg_policies 
  WHERE schemaname = 'storage' 
  ORDER BY tablename, policyname;
-- Should see: allow_anon_upload_evidence, allow_anon_read_evidence, allow_admin_read_evidence, allow_admin_delete_evidence

-- Check constraints
SELECT constraint_name, table_name 
  FROM information_schema.table_constraints 
  WHERE table_schema = 'public' 
    AND constraint_type = 'CHECK' 
  ORDER BY table_name;
-- Should include: chk_consent_given, chk_description_nonempty, chk_sha256_valid, chk_city_length, chk_badge_length

-- Check indexes
SELECT indexname 
  FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND tablename IN ('incident_reports', 'report_evidence');
-- Should include: idx_incident_reports_city_created, idx_report_evidence_report_id_created, idx_incident_reports_incident_at

-- Test anonymous insert (IMPORTANT - this verifies 401 fix)
INSERT INTO public.incident_reports (
  incident_at, location_text, description, consent_given
) VALUES (
  NOW(), 
  'Test location', 
  'Test description with sufficient length for validation', 
  true
) RETURNING id, report_code;
-- Should succeed and return new record with auto-generated report_code (AW-XXXXX)
```

---

## Phase 5: Security Spot-Check

### ✅ Authentication
- [ ] Unauthenticated user cannot access `/admin`
- [ ] Unauthenticated user cannot view report details
- [ ] Admin token expires correctly
- [ ] Expired token redirects to `/auth`

### ✅ Authorization
- [ ] Legal partner can view reports but NOT delete
- [ ] Admin can view and delete reports
- [ ] Anonymous users can submit but NOT view other reports
- [ ] Missing `user_roles` entry blocks access (access pending screen)

### ✅ Data Protection
- [ ] Officer names not visible in public dashboard
- [ ] Badge numbers not visible publicly
- [ ] Reporter contact info only visible to admins
- [ ] Anonymous submissions don't show contact details in admin view

### ✅ File Handling
- [ ] Files > 25 MB rejected on frontend AND backend
- [ ] Invalid MIME types rejected
- [ ] File hashes stored and match uploads
- [ ] GPS data extracted from EXIF and stored separately

---

## Phase 6: Performance Baseline

Test basic performance (optional but recommended):

```bash
# Frontend build size
ls -lh .output/public/assets/ | grep -E "\.(js|css)$"
# Largest file should be < 1MB gzip

# Dashboard query time
# In admin panel, open DevTools Network tab
# Load /dashboard
# Should complete in < 500ms
```

---

## Summary: Bugs Fixed

| # | Bug | File | Status |
|---|-----|------|--------|
| 1 | Timezone shift in date submission | report.tsx:371 | ✅ FIXED |
| 2 | No frontend file size validation | report.tsx:192 | ✅ FIXED |
| 3 | Evidence upload error handling poor | report.tsx:410 | ✅ FIXED |
| 4 | Quick exit hardcoded to weather.com | report.tsx:127 | ✅ FIXED |
| 5 | Missing contact field validation | report.tsx:step3Schema | ✅ FIXED |
| 6 | No incident date bounds validation | report.tsx:step1Schema | ✅ FIXED |
| 7 | CSV export formatting bug | dashboard.tsx:105 | ✅ FIXED |
| 8 | RLS policies too restrictive | DEPLOY_ALL.sql | ✅ TO APPLY |
| 9 | CORS not configured | Supabase Settings | ✅ TO APPLY |
| 10 | Storage policies incomplete | DEPLOY_ALL.sql | ✅ TO APPLY |
| 11 | No storage admin read access | DEPLOY_ALL.sql | ✅ TO APPLY |
| 12 | Missing SHA-256 constraint | DEPLOY_ALL.sql | ✅ TO APPLY |
| 13 | Missing performance indexes | DEPLOY_ALL.sql | ✅ TO APPLY |

---

## Next Steps

1. **Apply SQL fixes** from `FIX_ALL_CRITICAL.sql` in Supabase SQL Editor
2. **Configure CORS** in Supabase Settings → API
3. **Run verification queries** to confirm all fixes applied
4. **Start dev server:** `npm run dev` (should run on port 8080)
5. **Walk through Phase 3 tests** (manual testing checklist)
6. **Verify database** with Phase 4 verification queries
7. **Spot-check security** with Phase 5 checklist
8. **Ready for production** 🚀

---

## Troubleshooting

**If you see 401 Unauthorized:**
- [ ] CORS configured? Check Supabase Settings
- [ ] RLS policies applied? Check FIX_ALL_CRITICAL.sql
- [ ] Anon key valid? Check .env matches Supabase
- [ ] Incident_reports table exists? Run verification query

**If file upload fails:**
- [ ] Storage bucket "evidence" exists and is public?
- [ ] File < 25 MB?
- [ ] Storage policies applied from FIX_ALL_CRITICAL.sql?

**If admin can't see reports:**
- [ ] User has `admin` or `legal_partner` role in user_roles table?
- [ ] RLS policies applied?
- [ ] Authenticated as that user?

**If dashboard shows no data:**
- [ ] Any reports submitted?
- [ ] Reports have status not "pending_moderation"?
- [ ] City field populated in submissions?

