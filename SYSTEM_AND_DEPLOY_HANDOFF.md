# Koleqcia тАФ System Overview & Deploy Handoff

**Audience:** DevOps, backend/frontend owners, release manager
**Repo (production):** https://github.com/mozaikkonew/koleqcia (`main`)
**Product:** Multi-vendor marketplace for handmade anime / gaming / fanart decor (metal wall panels, figures, custom commissions). Multi-currency (GEL / USD), trilingual (EN / KA / RU).

Use this document as the single brief for what the system is, what each piece does, what must be provisioned, and what is still open before go-live.

Related detail docs in the same repo:

| Doc | Purpose |
|---|---|
| `README.md` | Quick start, local setup |
| `deploy/aws.env.example` | Full backend env checklist |
| `deploy/vercel.env.example` | Frontend env checklist |
| `deploy/AWS_POSTGRESQL.md` | RDS, SSL, migrations, SQLiteтЖТPostgres import |
| `PRODUCTION_RELEASE_CHECKLIST.md` | Release gate / QA checklist |
| `SECURITY_AUDIT.md` | Known security posture |

---

## 1. What the product does

- Customers browse catalog, artists, auctions, blog; buy products (incl. multi-vendor carts).
- Vendors sell under their own storefronts; admins operate the platform.
- Payments go through **Keepz** (Bank of Georgia stack). Georgian market can split settlement per vendor.
- Loyalty points, creator commissions, promo codes, gift wrap, per-vendor shipping + tracking.
- Real-time inbox / notifications over WebSockets.
- Geo-aware locale and currency (Georgia тЖТ KA / GEL when edge headers provide country).

---

## 2. High-level architecture

```
Browser
  тФВ
  тФЬтФАтЦ║ Frontend (Next.js)  тФАтФАHTTPSтФАтФАтЦ║  Vercel (or similar)
  тФВ         тФВ
  тФВ         тФФтФА REST + WS тФАтФАтЦ║ Backend (Django ASGI / Daphne)
  тФВ                                тФВ
  тФВ                    тФМтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФ╝тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФР
  тФВ                    тЦ╝           тЦ╝           тЦ╝
  тФВ               PostgreSQL     Redis      SMTP
  тФВ               (RDS)       (ElastiCache) (Gmail relay)
  тФВ                    тЦ▓           тЦ▓
  тФВ                    тФВ           тФВ
  тФВ              Celery worker + Celery Beat
  тФВ
  тФФтФАтЦ║ Keepz payment pages (customer pays at bank)
           тФВ
           тФФтФА webhook POST тФАтФАтЦ║ Backend /api/orders/payments/keepz/callback/
                              (backend NEVER trusts payload alone;
                               verifies via Keepz Order Status API)
```

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.7, Tailwind, pnpm 9 | Storefront + admin UI |
| Backend API | Django 5.1, DRF, SimpleJWT, django-filter, modeltranslation | REST API, business logic |
| Realtime | Django Channels + Daphne (ASGI) | WebSockets: messaging, auctions |
| Database | **PostgreSQL 16** in production | Source of truth. SQLite is local-only |
| Cache / broker | Redis 7 | Channel layer, Celery broker, distributed locks |
| Jobs | Celery 5.6 + Celery Beat | Payment reconciliation, async work |
| Payments | Keepz | Checkout, split settlement, refunds |
| Auth (social) | Google OAuth (Web Client ID) | Sign-in |
| Email | SMTP (Google Workspace relay preferred) | Transactional mail |
| Hosting (intended) | Frontend тЖТ Vercel; Backend тЖТ AWS (ASGI behind ALB/Nginx) | Production |

**Critical rule:** Production must run the API as **ASGI** (Daphne/Uvicorn with Channels). Plain WSGI alone breaks WebSockets (inbox / auctions).

---

## 3. Repository layout

```
koleqcia/
тФЬтФАтФА app/                    # Next.js App Router (locale storefront + admin)
тФЬтФАтФА components/             # React UI
тФЬтФАтФА lib/                    # Frontend helpers (auth, payment polling, i18n, SEO)
тФЬтФАтФА public/                 # Static assets (incl. og-koleqcia.jpg)
тФЬтФАтФА backend/
тФВ   тФЬтФАтФА apps/               # Django apps (orders, products, users, тАж)
тФВ   тФЬтФАтФА kolekcia/           # Project package (settings, asgi, celery, urls)
тФВ   тФЬтФАтФА manage.py
тФВ   тФЬтФАтФА requirements.txt
тФВ   тФФтФАтФА .env.example
тФЬтФАтФА deploy/                 # Env templates + AWS Postgres guide
тФЬтФАтФА docker-compose.yml      # Local Postgres 16 + Redis 7
тФЬтФАтФА .github/workflows/ci.yml
тФФтФАтФА SYSTEM_AND_DEPLOY_HANDOFF.md   # this file
```

### Django apps (backend)

| App | Responsibility |
|---|---|
| `users` | Accounts, JWT auth, Google Sign-In |
| `products` | Catalog, variants, stock, regional prices, ready-to-ship |
| `orders` | Cart, checkout, Keepz payments, shipments, refunds, inventory reservations |
| `vendors` | Vendor profiles / storefronts / merchant IDs |
| `auctions` | Auctions + bidding (HTTP + WS) |
| `messaging` | CustomerтЖФvendor inbox (HTTP + WS) |
| `gamification` | Loyalty tiers / points market |
| `promo` | Promo / voucher codes (incl. product/category scope) |
| `creators` | Creator applications + commissions |
| `cms` | Pages, announcement, site settings |
| `blog` | Blog |
| `contact` / `newsletter` | Contact form, newsletter |
| `emails` | Template emails (GrapesJS-managed templates) |
| `admin_api` | Staff/vendor admin REST API |
| `referrals` / `tenants` | Referrals, multi-tenant helpers |

### Settings modules

| Module | When to use |
|---|---|
| `kolekcia.settings.local` | Local/dev. SQLite by default; Postgres if `DATABASE_URL` is set |
| `kolekcia.settings.production` | **AWS / live.** Refuses to start without Postgres `DATABASE_URL` or with a `django-insecure-` key. Enforces HTTPS cookies/HSTS |
| `kolekcia.settings.postgres_test` | CI / test suite against Postgres (no SSL redirects, no real email) |

Always set:

```bash
DJANGO_SETTINGS_MODULE=kolekcia.settings.production
```

for API, Celery worker, Celery Beat, and migration jobs in AWS.

---

## 4. Runtime processes that must stay up

| Process | Command (backend dir) | Why |
|---|---|---|
| API (ASGI) | `daphne -b 0.0.0.0 -p 8000 kolekcia.asgi:application` (or equivalent under systemd/ECS) | HTTP API + WebSockets |
| Celery worker | `celery -A kolekcia worker -l info` | Async tasks |
| Celery Beat | `celery -A kolekcia beat -l info` | Schedules Keepz reconciliation (~every 5 min) |
| Postgres | Managed (RDS) | Data |
| Redis | Managed (ElastiCache) or container | Channels + broker + locks |

One-shot per deploy (single migration job, not on every replica at once):

```bash
cd backend
python manage.py migrate --noinput --settings=kolekcia.settings.production
python manage.py check --database default --settings=kolekcia.settings.production
```

Optional create admin after first boot:

```bash
python manage.py createsuperuser --settings=kolekcia.settings.production
```

---

## 5. Network / domains / edge

### Suggested production hosts

| Host | Points to |
|---|---|
| `https://www.koleqcia.com` (and apex) | Frontend |
| `https://api.koleqcia.com` | Backend ASGI |

These must match `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `ALLOWED_HOSTS`, CORS, CSRF, and Vercel `NEXT_PUBLIC_*` vars.

### Nginx / ALB expectations

- Terminate TLS in front of Django.
- Forward `X-Forwarded-Proto: https` (Django production settings use `SECURE_PROXY_SSL_HEADER`).
- For geo targeting, set country headers the frontend already understands, e.g.:
  - `X-Country-Code: GE`
  - `X-Country-Name: Georgia`
  (also supports CloudFront / Cloudflare equivalents тАФ see `proxy.ts`)

### WebSockets

- Upgrade path for `/ws/...` (messaging notifications, auctions) must reach the **same** ASGI app.
- Sticky sessions or Redis channel layer required when running multiple API instances (`REDIS_URL` must be set).

### Public callback Keepz must reach

```
POST https://api.koleqcia.com/api/orders/payments/keepz/callback/
```

Built from `BACKEND_PUBLIC_URL`. If that env stays at localhost, payments will not fulfill reliably (reconciliation is a fallback, not a substitute for a working webhook in production).

Frontend polls payment status (does **not** trust `?payment=success`):

```
GET /api/orders/<order-uuid>/status/
```

---

## 6. Data stores

### PostgreSQL (required in production)

- Engine: PostgreSQL 16 (see CI + `docker-compose.yml`).
- App connects via `DATABASE_URL=postgresql://USER:PASS@HOST:5432/koleqcia`.
- Prefer dedicated role `koleqcia_app`, not the RDS master user.
- SSL: `DB_SSLMODE=verify-full` + AWS RDS CA bundle path in `DB_SSLROOTCERT`.
- For ASGI: keep `DB_CONN_MAX_AGE=0`; use **RDS Proxy** if pooling is needed.
- Payment reconciliation uses PostgreSQL advisory locks тАФ avoid transaction-mode PgBouncer for payment workers (session affinity / direct RDS preferred). See `deploy/AWS_POSTGRESQL.md`.

### Redis

- Channel layer for WebSockets across workers.
- Celery broker.
- Distributed single-flight lock for reconciliation.

Without Redis, Django falls back to in-memory layers тАФ **unsafe** with >1 process.

### Media / uploads

- Code currently serves from `backend/media/` (`MEDIA_ROOT`).
- **Production must not rely on ephemeral container disk.**
- DevOps must provide either:
  - persistent volume mounted at media path, **or**
  - S3 (or similar) + code/config change (S3 is **not** fully wired as the default today тАФ treat as an open task if multi-instance API is planned).

Database dumps do **not** include uploaded images; copy media separately when migrating.

### Local compose (dev parity)

```bash
docker compose up -d   # Postgres :5432, Redis :6379
```

Credentials in compose: `koleqcia` / `koleqcia` / db `koleqcia`.

---

## 7. Payments (Keepz) тАФ how money works

Designed as **zero-trust**:

1. Checkout creates a `PaymentSession` and redirects the customer to Keepz.
2. Stock is **reserved** for payment window + buffer (default ~5 + 2 minutes).
3. Keepz webhook hits the callback URL тЖТ backend extracts order id тЖТ **server-to-server** status call verifies status / amount / currency.
4. On success: order тЖТ processing, stock finalized, confirmation email.
5. On failure/reject: order failed, stock released.
6. Amount mismatch тЖТ `needs_review` (stock kept, no silent fulfill).
7. Celery Beat reconciles pending sessions every ~5 minutes (same fulfillment code as webhook; idempotent).
8. Frontend return URL may say `payment=success`; UI shows тАЬVerifyingтАжтАЭ until backend confirms.

### Split settlement

- Multi-vendor Georgian carts can pay each vendorтАЩs Keepz merchant (`BRANCH` receivers).
- Each vendor gets an independent shipment / tracking number in admin.

### Refunds

- Admin can refund full or **partial** (per line item). Points and creator commission reverse **proportionally**.
- Gateway is called **before** local settlement so books never claim a refund that did not move.
- **Open blocker:** Keepz returned `Refund not allowed` (statusCode **6038**) for this integrator тАФ Keepz must enable refunds on the merchant/integrator account before live refund testing works.

### Keepz permissions still needed from provider

| Feature | Error if missing | Env flag |
|---|---|---|
| Order expiry `validUntil` | 6032 | `KEEPZ_ORDER_EXPIRY_ENABLED` (default off until granted) |
| Refunds | 6038 | Must be enabled by Keepz |

---

## 8. Environment variables

**Do not commit real values.** Put them in AWS Secrets Manager / Parameter Store / Vercel env.

Canonical lists:

- Backend: `deploy/aws.env.example` and `backend/.env.example`
- Frontend: `deploy/vercel.env.example`

### Backend тАФ must-set for production

| Variable | Purpose |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `kolekcia.settings.production` |
| `DEBUG` | `False` |
| `SECRET_KEY` | Long random; **not** `django-insecure-*` |
| `DATABASE_URL` | Postgres URL (required or boot fails) |
| `DB_SSLMODE` / `DB_SSLROOTCERT` | RDS TLS |
| `ALLOWED_HOSTS` | API hostnames |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | Frontend origins |
| `FRONTEND_URL` | Public storefront origin |
| `BACKEND_PUBLIC_URL` | Public API origin (webhooks + email image URLs) |
| `REDIS_URL` | Redis for Channels / locks |
| `CELERY_BROKER_URL` | Usually same Redis |
| `CELERY_TASK_ALWAYS_EAGER` | Must be `False` in prod |
| `KEEPZ_*` | Gateway credentials, receivers, split, windows |
| `EMAIL_*` | SMTP for transactional mail |
| `GOOGLE_CLIENT_ID` | Google Sign-In |

### Frontend тАФ must-set

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | e.g. `https://api.koleqcia.com/api` |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://www.koleqcia.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same OAuth web client as backend |

### Package manager

- Frontend uses **pnpm** (`packageManager: pnpm@9.15.0`).
- Only `pnpm-lock.yaml` is authoritative. Do not introduce a second lockfile.

---

## 9. CI

GitHub Actions (`.github/workflows/ci.yml`):

1. **Frontend:** `pnpm install --frozen-lockfile` тЖТ typecheck тЖТ vitest
2. **Backend (SQLite/local settings):** `manage.py check` + subset of tests
3. **Backend (Postgres 16 service):** migrate under **production** settings тЖТ full `manage.py test` under `postgres_test`

A migration that only works on SQLite will fail CI.

---

## 10. What DevOps must provision

### Accounts & access

- [ ] GitHub access to `mozaikkonew/koleqcia`
- [ ] AWS account / roles (ECS/EC2/Elastic Beanstalk тАФ whatever hosts ASGI)
- [ ] Vercel project (or alternate frontend host) linked to the org repo
- [ ] RDS PostgreSQL 16 (private subnet, backups, Multi-AZ recommended)
- [ ] Redis (ElastiCache or equivalent) with TLS if required
- [ ] Secrets Manager / Parameter Store for env
- [ ] DNS for `www` + `api` (+ TLS certificates)
- [ ] SMTP / Google Workspace relay credentials
- [ ] Keepz production credentials (from product owner)
- [ ] Google Cloud OAuth: authorized JS origins + redirect URIs for prod domains

### Infrastructure checklist

- [ ] ASGI service behind HTTPS load balancer / Nginx
- [ ] WebSocket upgrade support to the same service
- [ ] Celery worker service
- [ ] Celery Beat service (single instance)
- [ ] One-shot migration job on deploy
- [ ] Persistent media strategy (volume or S3)
- [ ] Log aggregation + alerts (API 5xx, Celery failures, payment `needs_review`)
- [ ] Automated RDS backups + restore drill
- [ ] Security groups: DB only from API/workers; Redis only from API/workers

### Config values product owner must fill

- Production domain names
- Keepz integrator / public / private keys / receiver IDs / split on-off
- Email from-addresses (`accounts@`, `orders@`, `auctions@`, тАж)
- Google OAuth client ID
- Whether to **migrate old SQLite/PythonAnywhere data** or start empty

---

## 11. Release / cutover order

From `deploy/AWS_POSTGRESQL.md` (summary):

1. Provision RDS + Redis + secrets; mount RDS CA bundle.
2. Deploy API with production settings; run **migrate** once.
3. If migrating data: maintenance mode тЖТ dump/import per AWS doc тЖТ copy media тЖТ verify counts.
4. Start API тЖТ Celery worker тЖТ Celery Beat.
5. Deploy frontend with production `NEXT_PUBLIC_*`.
6. Point DNS; confirm CORS/CSRF/hosts.
7. Register Keepz webhook URL; enable `KEEPZ_ENABLED=True` only after a dry run.
8. Smoke test (section 12).
9. First real low-value payment, then refund (once Keepz enables 6038).

Do **not** run old SQLite production and new Postgres production in parallel for live traffic тАФ payments and stock will diverge.

---

## 12. Smoke test after first deploy

Record evidence (screenshot / log / order id) for each:

1. API boots: `manage.py check --database default` under production settings
2. Homepage + `/en` `/ka` `/ru` load
3. Catalog + product images load from media URL
4. Register / login / Google Sign-In
5. Add to cart тЖТ checkout тЖТ redirect to Keepz
6. Complete tiny payment тЖТ order becomes `processing` without trusting query string
7. Confirmation email received
8. Admin sees order + per-vendor shipment cards
9. Inbox WebSocket / unread notifications work with тЙе2 API workers (if scaled)
10. Celery Beat log shows reconciliation tick
11. Forced reconcile: `python manage.py reconcile_keepz_payments --min-age-seconds 60`
12. (When Keepz allows) admin partial refund of one line

---

## 13. Open / known work (not finished by infra alone)

| Item | Owner | Notes |
|---|---|---|
| Keepz **refunds** permission (6038) | Product тЖФ Keepz | Blocks live refund money movement |
| Keepz `validUntil` permission (6032) | Product тЖФ Keepz | Optional; gated by `KEEPZ_ORDER_EXPIRY_ENABLED` |
| Media on S3 (or equivalent) | DevOps + eng | Needed for multi-instance / durable uploads |
| JWT in `localStorage` | Eng | Noted as HIGH in release checklist; HttpOnly cookies preferred long-term |
| Confirm PRODUCTION_RELEASE_CHECKLIST payment blockers | Eng | Checklist still has some outdated тАЬno paymentтАЭ wording; Keepz **is** implemented тАФ update checklist when validating |
| Geo headers on AWS Nginx | DevOps | Set `X-Country-Code` / `X-Country-Name` |
| Data migration from PythonAnywhere | Product decision | Empty DB vs import; see AWS doc ┬з3 |
| Monitoring / on-call | Ops | Who owns incidents |

---

## 14. Local development (for engineers)

```bash
# infra
docker compose up -d

# backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# optional: DATABASE_URL=postgresql://koleqcia:koleqcia@localhost:5432/koleqcia
python manage.py migrate --settings=kolekcia.settings.local
python manage.py runserver --settings=kolekcia.settings.local

# frontend (repo root)
pnpm install
cp .env.local.example .env.local
pnpm dev

# optional workers
celery -A kolekcia worker -l info
celery -A kolekcia beat -l info
```

Tests:

```bash
cd backend
python manage.py test --settings=kolekcia.settings.local
python manage.py test --settings=kolekcia.settings.postgres_test   # needs Postgres

pnpm typecheck && pnpm test
```

---

## 15. Contacts / ownership (fill in)

| Role | Name | Contact |
|---|---|---|
| Product owner | | |
| Engineering | | |
| DevOps | | |
| Keepz account manager | | |
| On-call / incidents | | |

---

## 16. One-paragraph brief (paste into Slack/email)

> Koleqcia is a Next.js + Django ASGI marketplace. Production needs PostgreSQL 16, Redis, an ASGI API, a Celery worker, and Celery Beat. Frontend is intended for Vercel; API for AWS behind HTTPS with WebSocket support. Payments use Keepz with zero-trust webhooks (`/api/orders/payments/keepz/callback/`) plus periodic reconciliation. Env templates live in `deploy/`. `BACKEND_PUBLIC_URL` must be the public API origin. Media needs durable storage. Keepz must still enable refunds (error 6038). Full detail: `SYSTEM_AND_DEPLOY_HANDOFF.md` in https://github.com/mozaikkonew/koleqcia.
