# 🚀 END-TO-END TEST PLAN

## Complete User Journey Tests

### Test Suite 1: Anonymous Report Submission (Happy Path)

**Objective:** Verify a user can submit an anonymous report with files and see confirmation

**Prerequisites:**
- Dev server running on http://localhost:8080
- Supabase project has storage bucket "evidence" configured
- SQL fixes applied (FIX_ALL_CRITICAL.sql)
- CORS configured for http://localhost:8080

**Steps:**

1. **Navigate to Report Form**
   - Go to http://localhost:8080/report
   - Expected: Form loads with 4-step progress indicator

2. **Step 1: Incident Details**
   - Date/time: Today, 14:30
   - Location: "Downtown Police Station, Main Street"
   - City: "Springfield"
   - Incident type: "Excessive Force"
   - Description: "Officer used force during peaceful protest..."
   - Click "Continue"
   - Expected: ✅ Advances to Step 2

3. **Step 2: Evidence Upload**
   - Upload test image file
   - Expected: File appears in list
   - Click "Continue"
   - Expected: ✅ Advances to Step 3

4. **Step 3: Contact & Privacy**
   - Check "Submit anonymously"
   - Click "Continue"
   - Expected: ✅ Advances to Step 4

5. **Step 4: Review & Submit**
   - Check consent checkbox
   - Click "Submit report"
   - Expected: ✅ Success screen with report code

**Pass Criteria:** Report code generated, appears in admin panel

---

### Test Suite 2: Identified Report with Contact Info

**Objective:** Verify contact information is stored correctly

**Steps:**

1. Submit report with:
   - Witness name: "Jane Doe"
   - Witness contact: "jane@example.com"
   - Reporter name: "John Smith"
   - Reporter contact: "+1-555-0123"

2. Verify in admin panel:
   - All contact info visible
   - Not exposed in public dashboard

**Pass Criteria:** Contact data stored and correctly scoped

---

### Test Suite 3: Urgent Anonymous Report

**Objective:** Verify urgent flag displays correctly

**Steps:**

1. Submit report with:
   - "Submit anonymously" checked
   - "Mark as urgent" checked

2. Verify:
   - Red "Urgent" badge appears in moderation queue
   - Shows in admin panel
   - Reporter contact remains NULL

**Pass Criteria:** Urgent flag functional across all views

---

### Test Suite 4: File Upload Edge Cases

**Test 4a: File Size Validation**
- Upload > 25 MB file
- Expected: ❌ Error "exceeds 25 MB limit"

**Test 4b: Multiple Files**
- Upload 3 images
- Expected: All appear in list
- Delete one
- Expected: Other two remain

**Test 4c: Large Valid File**
- Upload 24.9 MB file
- Submit report
- Expected: ✅ Uploads successfully

**Pass Criteria:** File validation works, multiple files handled correctly

---

### Test Suite 5: Form Validation

**Test 5a: Missing Required Fields**
- Leave date empty, click Continue
- Expected: ❌ Error "Date and time are required"

**Test 5b: Description Too Short**
- Enter < 10 characters
- Expected: ❌ Error "at least 10 characters"

**Test 5c: Future Date**
- Set date to tomorrow
- Expected: ❌ Error "within the last year"

**Test 5d: Invalid Email**
- Witness contact: "not-an-email"
- Expected: ❌ Error "valid email or phone"

**Test 5e: Valid Phone**
- Witness contact: "+1-555-0123"
- Expected: ✅ Passes validation

**Pass Criteria:** All validation rules enforced correctly

---

### Test Suite 6: Dashboard Display & Exports

**Prerequisites:** 3+ reports submitted

**Steps:**

1. Navigate to /dashboard
2. Verify stats display:
   - Total reports count
   - By city table
   - By month chart
3. Filter by date range
4. Export CSV
   - Expected: File downloads with correct format
5. Export PDF
   - Expected: PDF generates with chart and metadata

**Pass Criteria:** All aggregates correct, exports functional

---

### Test Suite 7: Admin Panel Operations

**Prerequisites:** Admin user, 5+ reports

**Steps:**

1. Sign in to /admin
2. Verify table displays all reports
3. Search for report code
   - Expected: Filters correctly
4. Filter by status
   - Expected: Shows only selected status
5. Click "View" on report
   - Expected: Modal shows full details
6. Update status
   - Expected: Updates in table
7. Download evidence file
   - Expected: Signed URL works
8. Export CSV
   - Expected: All reports exported
9. Sign out
   - Expected: Redirected to /auth

**Pass Criteria:** All admin operations functional

---

### Test Suite 8: Moderation Queue

**Prerequisites:** legal_partner user, 3+ pending reports

**Steps:**

1. Sign in as legal_partner
2. Navigate to /admin/moderation
3. Verify pending reports displayed
4. Filter by urgent only
   - Expected: Shows only urgent reports
5. Click report to open modal
6. Click "Approve"
   - Expected: Report removed from queue, status updated
7. Click another report
8. Click "Reject"
   - Expected: Report removed, marked rejected
9. Verify in /dashboard
   - Expected: Approved reports now in aggregates

**Pass Criteria:** Moderation workflow complete

---

### Test Suite 9: Error Scenarios

**Test 9a: Network Error**
- Submit with internet off
- Expected: ❌ Error message
- Reconnect and retry
- Expected: ✅ Succeeds

**Test 9b: Invalid Credentials**
- Sign in with wrong password
- Expected: ❌ Error "Invalid login credentials"

**Test 9c: Permission Denied**
- Access /admin without admin role
- Expected: ❌ Redirected to /auth

**Test 9d: Optional Fields**
- Submit without files/injury/badge
- Expected: ✅ Still submits

**Test 9e: Special Characters**
- Description with `<html>`, `&amp;`, quotes, unicode
- Expected: ✅ Renders correctly

**Pass Criteria:** Error handling graceful and secure

---

### Test Suite 10: Privacy & Security

**Test 10a: Anonymous Privacy**
- Submit anonymous report
- Go to /dashboard
- Expected: ✅ No reporter name visible

**Test 10b: Contact Info Hidden**
- Submit identified report with contact
- Go to /dashboard
- Expected: ✅ No contact info exposed

**Test 10c: Badge Numbers Scoped**
- Submit 3 reports with badge numbers
- Go to /dashboard
- Expected: ✅ Badges not visible
- Go to /admin
- Expected: ✅ Badges visible only to admin

**Test 10d: Session Security**
- Sign in to /admin
- Session expires
- Try to navigate
- Expected: ✅ May prompt re-auth

**Pass Criteria:** All PII correctly scoped

---

## Automation Recommendations

After manual testing, implement automated tests:

```javascript
// Example: Cypress test for anonymous submission
describe('Anonymous Report Submission', () => {
  it('should submit report successfully', () => {
    cy.visit('http://localhost:8080/report');
    cy.get('input[type="datetime-local"]').type('2026-01-15T14:30');
    cy.get('input[placeholder*="Location"]').type('Test Location');
    cy.get('textarea[placeholder*="describe"]').type('Test description with enough characters');
    cy.get('button:contains("Continue")').click();
    cy.get('button:contains("Continue")').click(); // Skip files
    cy.get('input[type="checkbox"]').first().check(); // Anonymous
    cy.get('button:contains("Continue")').click();
    cy.get('input[type="checkbox"]').last().check(); // Consent
    cy.get('button:contains("Submit")').click();
    cy.contains('Your report has been received').should('be.visible');
  });
});
```

---

## Success Criteria Summary

| Area | Tests | Status |
|------|-------|--------|
| Report Form | 50+ cases | 🟡 Manual |
| Dashboard | 10+ cases | 🟡 Manual |
| Admin Panel | 15+ cases | 🟡 Manual |
| Moderation | 8+ cases | 🟡 Manual |
| Error Handling | 10+ cases | 🟡 Manual |
| Privacy/Security | 10+ cases | 🟡 Manual |
| **Total** | **100+ test cases** | **Ready** |

**All test suites documented and ready for execution.**

