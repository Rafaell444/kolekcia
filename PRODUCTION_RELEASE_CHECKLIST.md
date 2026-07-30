# Koleqcia Production Release Checklist

Use this document as the release gate. Tick an item only after someone has verified it in the target environment and recorded evidence (test result, screenshot, log, or monitoring link).

Status legend: `[ ]` not verified, `[x]` verified, `[!]` known blocker or known risk requiring action.

## Release decision

- [ ] Product owner has approved the launch scope and supported countries/currencies.
- [ ] A named person owns production operations and incident response.
- [ ] A rollback decision-maker and rollback procedure are documented.
- [ ] All `BLOCKER` items below are closed or explicitly accepted in writing.
- [ ] A production smoke test has passed after the final deployment.

## Current codebase findings

- `[!] BLOCKER` No real payment-provider integration/webhook flow was found. Payment fields and payment links exist, but card/payment authorization, capture, refund, failure, retry, and provider signature verification still need implementation and testing.
- `[!] BLOCKER` JWT access and refresh tokens are stored in browser `localStorage` (`lib/auth-storage.ts` and `lib/admin-auth.ts`). Migrate refresh/admin credentials to secure, HttpOnly, Secure, SameSite cookies, with CSRF protection.
- `[!] BLOCKER` Local settings use SQLite and the security audit reports `backend/db.sqlite3` in the repository. Use PostgreSQL in production, remove database artifacts from source control, and rotate any exposed credentials.
- `[!] HIGH` Upload validation, imported image URLs, payout minimum enforcement, voucher collision handling, and vendor isolation have previously been identified as risks in `SECURITY_AUDIT.md`. Re-test each fix server-side.
- `[ ]` WebSockets require a production ASGI server and Redis channel layer. `InMemoryChannelLayer` is not suitable for multiple workers or multiple instances.

## 1. Product and customer journeys

- [ ] Browse home, catalog, category, product, artist, blog, FAQ, shipping, returns, privacy, cookies, terms, contact, custom-order, auction, cart, checkout, login, registration, password reset, and inbox pages.
- [ ] Test every supported locale: English, Georgian, and Russian.
- [ ] Test direct navigation and refresh on every localized route.
- [ ] Test unknown routes, missing products, missing artists, expired auctions, and deleted content.
- [ ] Verify navigation, search, filters, sorting, pagination, breadcrumbs, back buttons, and mobile bottom navigation.
- [ ] Verify product images, video, alt text, variants, prices, sale prices, stock, ready-to-ship state, and unavailable items.
- [ ] Verify cart add, remove, quantity changes, variant selection, persistence, empty state, promo codes, gift wrap, notes, shipping options, and totals.
- [ ] Verify prices, taxes/fees, shipping, discounts, rounding, currency display, exchange-rate fallback, and server-calculated totals match.
- [ ] Verify checkout validation for required name, email, phone, address, country, postal code, and shipping method.
- [ ] Verify guest checkout policy, authenticated checkout, session expiry, duplicate clicks, browser refresh, and back navigation.
- [ ] Verify order confirmation page, confirmation email, order history, order detail, shipment status, tracking, cancellation, and return request flows.
- [ ] Verify wishlist for anonymous and authenticated users, including login merge behavior.
- [ ] Verify newsletter subscription, contact form, creator application, referrals, gamification, reviews, and admin workflows.
- [ ] Verify auction scheduling, live state, bid validation, minimum increments, outbid behavior, closing, winner assignment, winner notification, and payment-pending state.
- [ ] Verify no UI claims a payment was completed before the server/provider confirms it.

## 2. Payment gateway: mandatory before launch

- [ ] Select the provider and confirm supported countries, currencies, payment methods, settlement, fees, disputes, refunds, and merchant/KYC requirements.
- [ ] Create server-side payment intent/order/session from trusted database values, never from client-supplied totals.
- [ ] Store provider transaction ID, order ID, amount, currency, status, timestamps, and failure reason.
- [ ] Use an idempotency key so retries and double-clicks cannot create or charge twice.
- [ ] Implement provider webhook endpoint with raw-body signature verification, event replay protection, and fast 2xx responses.
- [ ] Make webhook processing idempotent and transaction-safe; a repeated event must not duplicate an order, email, inventory decrement, or creator credit.
- [ ] Define state transitions for pending, authorized, paid, failed, cancelled, refunded, partially refunded, disputed, and expired.
- [ ] Reconcile browser return pages against the server payment status; never trust a success query parameter.
- [ ] Lock/reserve inventory during payment and release it safely after timeout/failure.
- [ ] Implement refunds, partial refunds, cancellations, chargebacks/disputes, and admin reconciliation.
- [ ] Test provider timeout, declined card, 3DS/SCA challenge, abandoned checkout, webhook delayed, webhook duplicated, webhook out of order, and provider outage.
- [ ] Test auction winner payment separately from normal cart checkout.
- [ ] Use provider test mode first, then a controlled real-money transaction with a refund.
- [ ] Ensure no raw card number, CVV, or secret provider key is stored or logged.
- [ ] Send payment/order emails only after the authoritative server state changes.

## 3. Authentication and authorization

- [ ] Migrate refresh and admin tokens out of `localStorage`; use secure HttpOnly cookies and a documented CSRF strategy.
- [ ] Confirm access tokens are short-lived, refresh rotation works, and logout blacklists/revokes refresh tokens.
- [ ] Confirm password hashing, minimum length, common-password rejection, reset-token expiry, single-use reset tokens, and account enumeration-safe responses.
- [ ] Add per-account login lockout or progressive delay in addition to IP throttling.
- [ ] Test Google login audience, issuer, nonce, redirect URI, and account-linking rules.
- [ ] Verify every endpoint has the correct permission: public, authenticated customer, vendor, staff, or superuser.
- [ ] Test horizontal privilege escalation: user A cannot read or modify user B, orders, conversations, files, payouts, or addresses.
- [ ] Test vendor isolation on products, orders, processing options, analytics, customers, payouts, and settings.
- [ ] Test object-level permissions through direct API calls, not only UI hiding.
- [ ] Verify admin roles are least-privilege and cannot self-promote.
- [ ] Verify sensitive admin actions require re-authentication or step-up confirmation where appropriate.
- [ ] Record immutable audit events for login, role changes, exports, refunds, payout changes, content changes, and destructive actions.

## 4. Security and privacy

- [ ] Production has `DEBUG=False`, a unique strong `SECRET_KEY`, exact `ALLOWED_HOSTS`, exact CORS origins, and exact CSRF trusted origins.
- [ ] HTTPS is enforced end-to-end; HSTS is enabled only after confirming all subdomains support HTTPS.
- [ ] Cookies use `Secure`, `HttpOnly`, and an intentional `SameSite` policy.
- [ ] Review CSP, frame protection, referrer policy, MIME sniffing protection, and security headers with a production scan.
- [ ] Validate uploaded files by magic bytes, size, dimensions, content type, and re-encode images with Pillow; strip dangerous metadata where appropriate.
- [ ] Store uploads outside executable paths and serve them from a safe media domain or object storage.
- [ ] Validate imported image URLs as HTTPS allowlisted URLs or download and re-host them; block SSRF, localhost, private IP, redirects, and non-image content.
- [ ] Validate all user-generated HTML/Markdown/email-editor content with an allowlist sanitizer.
- [ ] Render notes, messages, reviews, and CMS fields as text unless sanitized HTML is explicitly intended.
- [ ] Add request size limits, upload rate limits, login limits, password-reset limits, contact/newsletter limits, bid limits, and payment limits.
- [ ] Confirm throttling uses a shared production cache, not per-process memory.
- [ ] Run dependency vulnerability scans for npm and Python dependencies and patch critical/high findings.
- [ ] Run SAST, secret scanning, and an authenticated API/OWASP scan against staging.
- [ ] Remove `.env` files, database files, backups, tokens, SMTP passwords, provider keys, and test credentials from git history and deployment artifacts.
- [ ] Define privacy retention/deletion rules for accounts, orders, messages, addresses, audit logs, and marketing consent.
- [ ] Confirm consent, unsubscribe, cookie, privacy, terms, returns, shipping, and refund language matches actual behavior and applicable law.

## 5. Database and business correctness

- [ ] Use PostgreSQL in production with connection pooling and a tested backup policy.
- [ ] Run migrations in a staging clone and verify a clean production migration plan.
- [ ] Confirm every migration is committed, reversible where practical, and safe on a large dataset.
- [ ] Add unique constraints and database transactions for stock, orders, bids, promo codes, payouts, referrals, and payment records.
- [ ] Verify monetary values use Decimal/database numeric fields; never use floating point for totals.
- [ ] Server recalculates cart, shipping, discount, fees, currency, and creator commission values.
- [ ] Verify inventory cannot become negative under concurrent checkout or admin edits.
- [ ] Verify concurrent bids are ordered atomically and cannot bypass minimum increments.
- [ ] Verify creator ledger credits/debits are balanced, auditable, reversible, and cannot be duplicated.
- [ ] Add pagination and indexes for all list/search/admin endpoints; remove hard-coded large unpaginated responses.
- [ ] Review slow queries with realistic data and add `select_related`/`prefetch_related` where needed.
- [ ] Configure database statement timeout, connection health checks, and transaction timeouts.

## 6. WebSockets and messaging

- [ ] Run production through ASGI/Daphne or an equivalent ASGI server, not WSGI-only hosting.
- [ ] Configure Redis-backed Channels layer and verify all workers/instances share it.
- [ ] Configure proxy upgrade headers, `wss://`, idle timeouts, origin allowlist, and connection limits.
- [ ] Test anonymous connection rejection, expired-token rejection, invalid conversation ID, and unauthorized conversation access.
- [ ] Test customer, vendor, and staff access boundaries for every conversation and notification group.
- [ ] Test new message delivery, read updates, unread counts, ordering, duplicate delivery, reconnect, refresh-token retry, and logout.
- [ ] Test two browser tabs, two devices, multiple workers, and multiple app instances.
- [ ] Test network loss, sleep/wake, Wi-Fi change, backend restart, Redis restart, and reconnect backoff.
- [ ] Confirm the HTTP polling fallback is correct, bounded, and does not create a request storm.
- [ ] Add server-side message size limits, abuse throttling, spam controls, and connection quotas.
- [ ] Confirm sensitive tokens never appear in URLs, proxy logs, analytics, browser history, or error reports.
- [ ] Test auction chat and auction event delivery under active bidding separately from inbox chat.
- [ ] Monitor active connections, rejected connections, reconnect rate, message latency, channel-layer errors, and Redis memory.

## 7. Reliability, scale, and load testing

- [ ] Define targets: peak requests/minute, concurrent users, WebSocket connections, p95/p99 latency, error rate, and recovery time.
- [ ] Load-test anonymous browsing, search, product detail, login, cart, checkout creation, admin lists, bids, and messaging independently.
- [ ] Test a realistic mixed workload, not only one endpoint.
- [ ] Test at 1x expected peak, 2x peak, and a short burst above peak.
- [ ] Confirm p95/p99 latency and 5xx/429 rates remain within agreed limits.
- [ ] Confirm the app remains responsive while database, Redis, email, image storage, exchange-rate, or payment providers are slow/unavailable.
- [ ] Confirm timeouts, bounded retries, circuit breakers, and graceful error messages for external services.
- [ ] Confirm worker/process/container memory stays bounded and no file descriptor or connection leak occurs.
- [ ] Confirm database connection count, slow queries, locks, CPU, memory, disk, and Redis memory stay within limits.
- [ ] Confirm static assets are cached/CDN-served and large images are optimized and lazy-loaded.
- [ ] Confirm background work such as emails, auction closing, reconciliation, and imports does not block web requests.
- [ ] Run soak test for at least 1-4 hours and inspect memory, connections, queue depth, and error trends.
- [ ] Test graceful deploy: existing requests and WebSockets drain, new traffic shifts safely, and rollback works.
- [ ] Verify health/readiness checks detect unavailable database, Redis, migrations, and critical dependencies.

## 8. Testing and quality gates

- [ ] `pnpm lint` passes with zero errors.
- [ ] `pnpm typecheck` passes with zero errors.
- [ ] `pnpm test` passes, including locale/SEO tests.
- [ ] Backend test suite passes with a clean test database.
- [ ] Add tests for payment state transitions, webhooks, idempotency, refunds, and inventory concurrency.
- [ ] Add API tests for object-level authorization and vendor isolation.
- [ ] Add upload, import, SSRF, XSS, throttling, and password-reset abuse tests.
- [ ] Add WebSocket tests for auth, access control, reconnect, multi-client delivery, and Redis-backed operation.
- [ ] Run browser E2E tests on Chrome, Safari, Firefox, iOS Safari, and Android Chrome at mobile/tablet/desktop sizes.
- [ ] Test keyboard-only navigation, focus order, dialogs, labels, error announcements, contrast, reduced motion, and screen readers.
- [ ] Test slow 3G, offline transitions, empty states, loading states, retries, and server errors.
- [ ] Run Lighthouse/Core Web Vitals and fix major LCP, CLS, INP, accessibility, and SEO issues.
- [ ] Verify sitemap, robots, canonical URLs, hreflang, Open Graph, structured data, 404/500 pages, and no-index admin pages.

## 9. Deployment and operations

- [ ] Separate development, staging, and production credentials, databases, storage, domains, and analytics.
- [ ] Pin and review Node/Python/runtime versions; deploy from a reproducible lockfile/build.
- [ ] Build the frontend and run it with `next start`; do not use the development server in production.
- [ ] Collect static files and configure media/static storage correctly.
- [ ] Configure environment variables through the secret manager; verify no secrets are printed at startup.
- [ ] Configure structured logs with request ID, user ID where safe, order ID, payment ID, and severity, while excluding secrets/PII.
- [ ] Add error monitoring for frontend, backend, workers, WebSockets, payment webhooks, and scheduled jobs.
- [ ] Add uptime checks for frontend, API, database, Redis, WebSocket handshake, and payment webhook endpoint.
- [ ] Configure alerts for 5xx, latency, failed payments, webhook failures, queue backlog, Redis health, DB saturation, disk, and certificate expiry.
- [ ] Back up PostgreSQL, media, and critical configuration; encrypt backups and test restoration.
- [ ] Document RPO/RTO, rollback, database restore, secret rotation, payment reconciliation, and provider outage procedures.
- [ ] Configure scheduled jobs and verify auction closing, cleanup, email retries, exchange-rate updates, and reconciliation actually run.
- [ ] Verify time zone, clock synchronization, locale, currency, and daylight-saving behavior.
- [ ] Verify DNS, TLS certificate, email SPF, DKIM, DMARC, return-path, and sender reputation.

## 10. Final go-live smoke test

- [ ] Open the production URL in a private browser window.
- [ ] Register a test customer, verify email behavior, log in, log out, and reset the password.
- [ ] Browse in each locale, add a real test product to cart, and verify totals.
- [ ] Complete a provider test payment or controlled real payment, confirm webhook processing, email, order, inventory, and admin status.
- [ ] Send a customer/vendor message, open a second client, verify real-time delivery and read state.
- [ ] Place a test auction bid with a second account and verify outbid/close/winner behavior.
- [ ] Confirm monitoring received the expected events and no secret/PII appeared in logs.
- [ ] Record deployment version, migration version, test order IDs, payment IDs, and rollback point.
- [ ] Remove or anonymize all test data and disable test-mode credentials before public launch.

## Recommended implementation order

1. Implement and test the payment provider, webhook, idempotency, refunds, and reconciliation.
2. Fix authentication storage and admin authorization before exposing real customer data.
3. Move production data to PostgreSQL, Redis, object storage, and a real ASGI deployment.
4. Close the upload/import/tenant-isolation/business-logic findings in `SECURITY_AUDIT.md`.
5. Add missing backend, payment, authorization, WebSocket, and E2E tests.
6. Run load/soak tests, configure monitoring/backups/restore, then perform the final smoke test.

## Highest-value optimizations after launch

- Add a background job system for email, imports, image processing, auction closing, and payment reconciliation.
- Add CDN/object storage and responsive image generation for product and CMS media.
- Add database indexes based on production query plans and enforce pagination everywhere.
- Add caching for public catalog/CMS responses with safe invalidation after admin edits.
- Add feature flags for payments, auctions, WebSockets, and new checkout behavior so risky changes can be rolled back independently.
- Add business dashboards for conversion, checkout abandonment, payment success, refunds, inventory errors, WebSocket health, and support volume.
- Establish monthly dependency updates, quarterly access reviews, restore drills, and recurring penetration testing.
