# Security Audit Report — Kolekcia

**Date:** 2026-07-27  
**Scope:** Full-stack (Next.js frontend + Django REST backend)

---

## CRITICAL

### 1. JWT tokens stored in localStorage
**File:** `lib/auth-storage.ts`, `lib/admin-auth.ts`  
Access tokens and refresh tokens are stored in `localStorage`. Any XSS vulnerability can steal them permanently.  
**Fix:** Store tokens in `httpOnly` cookies set by the server. If localStorage must be used, at minimum store only short-lived access tokens and never the refresh token.

### 2. Admin JWT stored in localStorage
**File:** `lib/admin-auth.ts`  
Admin tokens (with elevated privileges) are also in `localStorage`. An XSS attack on any admin page gives full admin access.  
**Fix:** Same as above — `httpOnly` cookies. Admin tokens are higher risk than user tokens.

### 3. `db.sqlite3` committed to repository
**File:** `backend/db.sqlite3`  
The SQLite database file is present in the repo. It likely contains real user data, hashed passwords, orders, and PII.  
**Fix:** Add `*.sqlite3` to `.gitignore` immediately. Rotate all credentials. Audit what data was exposed.

---

## HIGH

### 4. No CSRF protection on state-changing API endpoints
The backend uses JWT Bearer tokens (stateless), which are not vulnerable to classic CSRF. However, if tokens are ever moved to cookies (the correct fix for issue #1), CSRF protection must be added simultaneously via Django's `CsrfViewMiddleware` or `SameSite=Strict` cookie attribute.  
**Fix:** Plan CSRF protection as part of the cookie migration.

### 5. File upload: MIME type validated by extension only
**File:** `backend/apps/core/uploads.py` (referenced in `AdminMediaUploadView`)  
Image uploads use `safe_image_extension()` which checks the file extension. A malicious file with a `.jpg` extension but executable content could bypass this.  
**Fix:** Validate MIME type by reading file magic bytes (e.g., `python-magic` or `imghdr`), not just the extension. Re-encode images through Pillow to strip metadata and ensure they are valid images.

### 6. Product import accepts arbitrary URLs as image sources
**File:** `backend/apps/admin_api/views.py` — `AdminProductImportView`  
The XLSX import creates `ProductImage` records with any URL from the spreadsheet without validation. This could be used to store SSRF-triggering URLs or phishing image links.  
**Fix:** Validate that image URLs are absolute HTTPS URLs pointing to allowed domains, or download and re-host them locally.

### 7. Payout request: no server-side minimum balance check
**File:** `backend/apps/creators/` (payout request endpoint)  
The payout minimum is stored as a `SiteSettings` value and enforced client-side in `CreatorPanel.tsx`. If the API endpoint for requesting a payout does not re-validate the minimum server-side, a user can bypass it with a direct API call.  
**Fix:** Re-check `available_balance >= payout_minimum` in the payout request view before creating the `CreatorPayoutRequest`.

### 8. Voucher code collision check is incomplete
**File:** `backend/apps/admin_api/views.py` — `AdminContentCreatorListView.post`  
The code checks `PromoCode.objects.filter(code=code).exclude(owner=user).exclude(owner__isnull=True)` but the two separate `.exclude()` calls are ANDed, not ORed. A code owned by another user could slip through.  
**Fix:** Use `Q` objects: `PromoCode.objects.filter(code=code).exclude(Q(owner=user) | Q(owner__isnull=True)).exists()`.

---

## MEDIUM

### 9. Admin login endpoint lacks account lockout
**File:** `backend/apps/admin_api/views.py` — `AdminLoginView`  
Rate limiting uses `ScopedRateThrottle` with scope `admin_auth`, which is good. However, there is no per-account lockout after N failed attempts. An attacker can rotate IPs to bypass IP-based throttling.  
**Fix:** Track failed login attempts per email in cache/DB and lock the account for a period after 5–10 failures.

### 10. `confirm()` used for destructive admin actions
**File:** `app/admin/creators/page.tsx` — `deactivateCreator`  
Browser `confirm()` dialogs can be suppressed by browser settings and provide no audit trail.  
**Fix:** Replace with a modal dialog that requires typing the creator's name or email to confirm, and log the action.

### 11. Ledger and voucher-use endpoints return up to 500/200 rows without pagination
**File:** `backend/apps/admin_api/views.py` — `AdminCreatorLedgerListView`, `AdminCreatorVoucherUsesView`  
Hard-coded limits of 500 and 200 rows are returned in a single response. As data grows this will cause memory and timeout issues, and exposes large amounts of data per request.  
**Fix:** Add cursor-based or page-number pagination.

### 12. `order_number` search uses `__icontains` on ledger
**File:** `backend/apps/admin_api/views.py` — `AdminCreatorLedgerListView`  
`qs.filter(order_number__icontains=order_number)` with a short search string (e.g., `"1"`) will match thousands of rows and scan the full table.  
**Fix:** Use `__istartswith` or require a minimum search length of 4+ characters.

### 13. Vendor isolation not enforced on `AdminProcessingOptionDetailView`
**File:** `backend/apps/admin_api/views.py` — `AdminProcessingOptionDetailView`  
The `patch` and `delete` methods fetch `ProcessingOption` by PK without checking that the option belongs to the requesting vendor. A vendor admin can modify another vendor's processing options.  
**Fix:** Add `select_related("vendor")` and verify `opt.vendor == request.user.vendor_profile` for non-staff users.

### 14. `ALLOWED_MEDIA_FOLDERS` whitelist is good but folder traversal not checked
**File:** `backend/apps/admin_api/views.py` — `AdminMediaUploadView`  
The folder is validated against a whitelist, but the filename is generated from `uuid4().hex` which is safe. However, the `folder` value is `.strip().lower()` — a value like `blog/../../../etc` would pass the whitelist check if `blog` is in the set.  
**Fix:** After stripping, assert `folder in ALLOWED_MEDIA_FOLDERS` (already done), but also assert `os.path.basename(folder) == folder` to prevent any path traversal.

### 15. Email template `event_key` not validated against known keys
**File:** `backend/apps/admin_api/views.py` — `AdminEmailTemplateListView.post`  
Any string can be stored as `event_key`. A typo silently creates a dead template that is never triggered.  
**Fix:** Validate `event_key` against a known set of event keys (e.g., `order_shipped`, `order_confirmed`, etc.).

### 16. `proxy.ts` forwards all requests without origin validation
**File:** `proxy.ts`  
The dev proxy forwards all `/api/` requests. Ensure this file is not deployed to production and that the production Next.js config does not expose a proxy that forwards arbitrary backend requests.  
**Fix:** Confirm `proxy.ts` is only used in development. Add a check that it is excluded from production builds.

---

## LOW / INFORMATIONAL

### 17. `fail_silently=True` on all email sends hides delivery failures
**File:** `backend/apps/admin_api/views.py` — `_send_shipping_email`  
Email failures are silently swallowed. Admins have no visibility into failed shipping notifications.  
**Fix:** Log failures to the audit log or a dedicated error log rather than silently ignoring them.

### 18. `admin_note` field on payout requests is not sanitized
**File:** `backend/apps/admin_api/views.py` — `AdminCreatorPayoutDetailView`  
Admin notes are stored as-is. If they are ever rendered as HTML in the frontend, they could be an XSS vector.  
**Fix:** Ensure admin notes are always rendered as plain text (not `dangerouslySetInnerHTML`).

### 19. `creator.country` truncated to 5 chars without format validation
**File:** `backend/apps/admin_api/views.py` — `AdminContentCreatorDetailView.patch`  
`str(new_country).upper()[:5]` accepts any 5-character string. ISO 3166-1 alpha-2 codes are 2 characters.  
**Fix:** Validate against a list of valid ISO country codes.

### 20. Audit log `target_id` stored as string, not typed
**File:** `backend/apps/admin_api/models.py` (AuditLog)  
`target_id` is a string field. Querying by target ID requires string comparison, which can miss integer-keyed records if the format is inconsistent.  
**Fix:** Standardize all `log_action` calls to pass `str(pk)` consistently, or use a typed field.

### 21. `db.sqlite3` is unsuitable for production
SQLite has no concurrent write support. Under any real load, write operations will serialize and cause timeouts.  
**Fix:** Migrate to PostgreSQL before any production deployment.

### 22. `SECRET_KEY` and `DEBUG` settings
Ensure `DEBUG=False` and a strong random `SECRET_KEY` in production. The `deploy/` example files suggest this is known, but confirm via deployment checklist.

---

## Summary Table

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | CRITICAL | Auth | JWT in localStorage |
| 2 | CRITICAL | Auth | Admin JWT in localStorage |
| 3 | CRITICAL | Data | SQLite DB in repo |
| 4 | HIGH | Auth | CSRF (future cookie migration) |
| 5 | HIGH | Upload | Extension-only MIME validation |
| 6 | HIGH | Import | Unvalidated image URLs in XLSX import |
| 7 | HIGH | Business logic | Payout minimum not server-side enforced |
| 8 | HIGH | Business logic | Voucher collision check logic error |
| 9 | MEDIUM | Auth | No per-account login lockout |
| 10 | MEDIUM | UX/Audit | `confirm()` for destructive actions |
| 11 | MEDIUM | Performance | Unpaginated large result sets |
| 12 | MEDIUM | Performance | Unbounded `icontains` search |
| 13 | MEDIUM | AuthZ | Vendor isolation missing on processing options |
| 14 | MEDIUM | Upload | Potential path traversal in folder param |
| 15 | MEDIUM | Data | Unvalidated email event_key |
| 16 | MEDIUM | Infra | Proxy.ts in production risk |
| 17 | LOW | Ops | Silent email failures |
| 18 | LOW | XSS | Unsanitized admin notes |
| 19 | LOW | Data | Country code not validated |
| 20 | LOW | Data | Audit log target_id type inconsistency |
| 21 | LOW | Infra | SQLite not production-ready |
| 22 | LOW | Config | SECRET_KEY / DEBUG reminder |
