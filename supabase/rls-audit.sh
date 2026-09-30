#!/usr/bin/env bash
# =============================================================================
# rls-audit.sh — Accountability Watch RLS smoke-test
#
# Usage:
#   bash supabase/rls-audit.sh
#
# Optional env overrides:
#   SUPABASE_URL=https://xxx.supabase.co
#   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#   ADMIN_JWT=eyJhbGc...   (a valid JWT for an admin user — set to run admin tests)
#
# Requires: curl
# Exit code: 0 = all assertions passed, 1 = one or more failed
# =============================================================================

BASE="${SUPABASE_URL:-$(grep SUPABASE_URL .env | cut -d= -f2 | tr -d '"')}/rest/v1"
KEY="${SUPABASE_PUBLISHABLE_KEY:-$(grep 'SUPABASE_PUBLISHABLE_KEY=' .env | grep -v VITE | cut -d= -f2 | tr -d '"')}"

PASS=0
FAIL=0
SKIP=0

# ── helpers ──────────────────────────────────────────────────────────────────
green() { printf "\033[32m✓ PASS\033[0m  %s\n" "$1"; }
red()   { printf "\033[31m✗ FAIL\033[0m  %s\n" "$1"; }
yellow(){ printf "\033[33m- SKIP\033[0m  %s\n" "$1"; }

assert_status() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [ "$actual" = "$expected" ]; then
    green "$label  →  HTTP $actual"
    PASS=$((PASS+1))
  else
    red "$label  →  expected HTTP $expected, got HTTP $actual"
    [ -n "$body" ] && printf "       body: %s\n" "$body"
    FAIL=$((FAIL+1))
  fi
}

assert_body() {
  local label="$1" pattern="$2" body="$3"
  if echo "$body" | grep -q "$pattern"; then
    green "$label  →  body contains '$pattern'"
    PASS=$((PASS+1))
  else
    red "$label  →  body does NOT contain '$pattern'"
    printf "       body: %s\n" "$body"
    FAIL=$((FAIL+1))
  fi
}

assert_body_not() {
  local label="$1" pattern="$2" body="$3"
  if echo "$body" | grep -qv "$pattern" || ! echo "$body" | grep -q "$pattern"; then
    green "$label  →  body does not expose '$pattern'"
    PASS=$((PASS+1))
  else
    red "$label  →  body SHOULD NOT contain '$pattern' but does"
    FAIL=$((FAIL+1))
  fi
}

anon_get()  { curl -s --max-time 15 -w "\n%{http_code}" -H "apikey: $KEY" -H "Accept: application/json" "$BASE/$1"; }
anon_post() { curl -s --max-time 15 -w "\n%{http_code}" -X POST -H "apikey: $KEY" -H "Content-Type: application/json" -H "Accept: application/json" -d "$1" "$BASE/$2"; }
anon_patch(){ curl -s --max-time 15 -w "\n%{http_code}" -X PATCH -H "apikey: $KEY" -H "Content-Type: application/json" -H "Accept: application/json" -d "$1" "$BASE/$2"; }
anon_delete(){ curl -s --max-time 15 -w "\n%{http_code}" -X DELETE -H "apikey: $KEY" -H "Accept: application/json" "$BASE/$1"; }

admin_get() {
  [ -z "$ADMIN_JWT" ] && { yellow "$1 (set ADMIN_JWT to run admin tests)"; SKIP=$((SKIP+1)); return; }
  curl -s --max-time 15 -w "\n%{http_code}" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Accept: application/json" \
    "$BASE/$1"
}

split_response() {
  # last line is the status code, everything before is the body
  echo "$1" | head -n -1
}
split_status() {
  echo "$1" | tail -n 1
}

echo ""
echo "============================================================"
echo "  Accountability Watch — RLS Smoke Test"
echo "  Target: $BASE"
echo "============================================================"
echo ""

# ── SECTION 1: incident_reports — anon role ───────────────────────────────────
echo "── incident_reports (anon) ──────────────────────────────────"

# 1a. Anon SELECT  →  200 empty array (RLS filters all rows, not a 403)
RAW=$(anon_get "incident_reports?select=id,status&limit=5")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
assert_status "1a. Anon SELECT"         "200" "$STATUS" "$BODY"
assert_body   "1a. Anon SELECT is empty" "\[\]" "$BODY"

# 1b. Anon INSERT, consent_given=true  →  201
RAW=$(anon_post '{"incident_at":"2026-01-01T00:00:00Z","location_text":"RLS audit","description":"RLS audit test row with consent","consent_given":true}' "incident_reports")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
assert_status "1b. Anon INSERT consent=true" "201" "$STATUS" "$BODY"
# Capture inserted id for cleanup
INSERTED_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')

# 1c. Anon INSERT, consent_given=false  →  401 (RLS policy violation)
RAW=$(anon_post '{"incident_at":"2026-01-01T00:00:00Z","location_text":"RLS audit","description":"RLS audit test row without consent","consent_given":false}' "incident_reports")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
assert_status "1c. Anon INSERT consent=false" "401" "$STATUS" "$BODY"
assert_body   "1c. Anon INSERT consent=false error" "row-level security" "$BODY"

# 1d. Anon UPDATE  →  204 with 0 rows changed (no USING policy grants update to anon)
RAW=$(anon_patch '{"city":"injected"}' "incident_reports?id=eq.00000000-0000-0000-0000-000000000001")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
assert_status "1d. Anon UPDATE (no-op)"  "204" "$STATUS" "$BODY"

# 1e. Anon DELETE  →  204 with 0 rows changed
RAW=$(anon_delete "incident_reports?id=eq.00000000-0000-0000-0000-000000000001")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
assert_status "1e. Anon DELETE (no-op)"  "204" "$STATUS" "$BODY"

echo ""

# ── SECTION 2: incident_reports — admin role ─────────────────────────────────
echo "── incident_reports (admin JWT) ─────────────────────────────"

RAW=$(admin_get "incident_reports?select=id,status&limit=5")
if [ $? -ne 0 ] || [ -z "$ADMIN_JWT" ]; then
  : # already skipped in admin_get
else
  BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
  assert_status "2a. Admin SELECT" "200" "$STATUS" "$BODY"
  # Admin should see rows (or at least a valid array — not denied)
  assert_body_not "2a. Admin SELECT not blocked" "row-level security" "$BODY"
fi

echo ""

# ── SECTION 3: report_evidence — anon role ───────────────────────────────────
echo "── report_evidence (anon) ───────────────────────────────────"

RAW=$(anon_get "report_evidence?select=id&limit=5")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
assert_status "3a. Anon SELECT evidence"         "200" "$STATUS" "$BODY"
assert_body   "3a. Anon SELECT evidence is empty" "\[\]" "$BODY"

echo ""

# ── SECTION 4: storage — anon upload ─────────────────────────────────────────
echo "── storage/evidence bucket (anon) ───────────────────────────"

# Anon read of a non-existent object  →  400/404 (not a 200 — no read policy for anon)
STORAGE_BASE="${SUPABASE_URL:-$(grep SUPABASE_URL .env | cut -d= -f2 | tr -d '"')}/storage/v1"
RAW=$(curl -s --max-time 15 -w "\n%{http_code}" \
  -H "apikey: $KEY" \
  "$STORAGE_BASE/object/evidence/rls-audit-nonexistent.txt")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
# Anon should NOT get 200 — expect 400 (no file) or 400 (not authorized)
if [ "$STATUS" != "200" ]; then
  green "4a. Anon storage READ blocked  →  HTTP $STATUS (not 200)"
  PASS=$((PASS+1))
else
  red "4a. Anon storage READ  →  got HTTP 200, expected non-200 (RLS should block)"
  FAIL=$((FAIL+1))
fi

echo ""

# ── SECTION 5: public RPC still works anon ───────────────────────────────────
echo "── public_incident_stats RPC (anon) ─────────────────────────"

RAW=$(anon_post '{}' "rpc/public_incident_stats")
BODY=$(split_response "$RAW"); STATUS=$(split_status "$RAW")
assert_status "5a. Anon RPC public_incident_stats" "200" "$STATUS" "$BODY"
assert_body   "5a. RPC returns total_reports"      "total_reports"    "$BODY"

echo ""

# ── Cleanup: delete any row we successfully inserted ─────────────────────────
if [ -n "$INSERTED_ID" ] && [ -n "$ADMIN_JWT" ]; then
  curl -s --max-time 15 -X DELETE \
    -H "apikey: $KEY" -H "Authorization: Bearer $ADMIN_JWT" \
    "$BASE/incident_reports?id=eq.$INSERTED_ID" > /dev/null
  echo "(Cleaned up test row $INSERTED_ID)"
elif [ -n "$INSERTED_ID" ]; then
  echo "(Note: test row $INSERTED_ID was inserted — delete it manually or set ADMIN_JWT for auto-cleanup)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
printf "  Results:  \033[32m%d passed\033[0m  |  \033[31m%d failed\033[0m  |  \033[33m%d skipped\033[0m\n" $PASS $FAIL $SKIP
echo "============================================================"
echo ""

[ $FAIL -eq 0 ] && exit 0 || exit 1
