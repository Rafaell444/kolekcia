# AWS PostgreSQL deployment

Local development and automated application tests continue to use
`backend/db.sqlite3`. Production settings require PostgreSQL and stop at startup
if `DATABASE_URL` is missing or points to SQLite.
Standalone ASGI, WSGI, and Celery entry points default to production settings;
`manage.py` defaults to local SQLite. Always set `DJANGO_SETTINGS_MODULE` in the
AWS process environment, including migration and maintenance jobs. For a local
standalone Celery worker, explicitly set it to `kolekcia.settings.local`.

## 1. Create RDS

Create an Amazon RDS PostgreSQL instance in the same VPC and region as the API.
Do not make the database publicly accessible. Its security group should accept
port 5432 only from the API service's security group. Enable automated backups,
deletion protection, encryption at rest, and Multi-AZ for a high-availability
production environment.

Create a dedicated application database and login rather than using the RDS
master user:

```sql
CREATE ROLE koleqcia_app WITH LOGIN PASSWORD 'GENERATE_A_STRONG_PASSWORD';
CREATE DATABASE koleqcia OWNER koleqcia_app;
```

Store the password and full `DATABASE_URL` in AWS Secrets Manager or Parameter
Store. URL-encode special characters in the password.

For production ASGI processes, keep `DB_CONN_MAX_AGE=0`. Use RDS Proxy if the
API needs connection pooling; point `DATABASE_URL` at the proxy endpoint while
leaving the database name and credentials unchanged.

## 2. Configure the API

Use `deploy/aws.env.example` as the variable checklist. Download the current AWS
RDS global CA bundle to the API host and configure `DB_SSLMODE=verify-full` and
`DB_SSLROOTCERT` to its absolute path. Never commit the populated environment
file.

Before starting application workers, run exactly one migration job:

```bash
cd /path/to/kolekcia/backend
python manage.py migrate --noinput --settings=kolekcia.settings.production
python manage.py check --database default --settings=kolekcia.settings.production
```

All API, Celery worker, Celery Beat, and maintenance processes must target the
same database and use the production settings module. Reconciliation uses a
session-level PostgreSQL advisory lock for the complete run (including provider
calls), so use direct RDS connections for payment workers, or a proxy that
preserves session affinity. Do not use transaction-mode PgBouncer connections
for reconciliation.

The critical PostgreSQL tests use independent database connections to verify
row-lock contention, duplicate callbacks, competing stock reservations,
success-versus-expiration, simultaneous bidding, and overlapping reconciliation.
Run the complete suite against a separate PostgreSQL test database before release:

```bash
python manage.py test --settings=kolekcia.settings.postgres_test
```

Use disposable test credentials with permission to create a test database, never
the live production credentials. Test settings disable HTTPS redirects and
outbound email and must not be used to serve the application.

## 3. Move existing SQLite data (only if it must be preserved)

Stop writes during the transfer. Back up both the SQLite file and uploaded media.
From the old deployment, export application data while using local settings:

```bash
python manage.py audit_postgres_data --settings=kolekcia.settings.local
python -X utf8 manage.py dumpdata --settings=kolekcia.settings.local --all --natural-foreign --exclude contenttypes --exclude auth.permission --indent 2 --output data-export.json
```

Stop if the audit reports oversized strings or NUL characters. It is read-only
and reports field names/counts without printing customer data. UTF-8 mode avoids
Windows encoding failures for Georgian and other Unicode text. The fixture
contains private customer/payment records; keep it out of Git and remove the
temporary transfer copy after verifying the destination and securing backups.
Do not add `--natural-primary`: retain user UUIDs and all other primary keys,
including IDs referenced by signed tokens or payment metadata.

On the AWS API host, migrate the empty PostgreSQL database first, then import:

```bash
python manage.py migrate --noinput --settings=kolekcia.settings.production
python manage.py import_database_snapshot data-export.json --settings=kolekcia.settings.production
```

The importer refuses destinations containing business data, requires all
migrations, preserves primary keys, and replaces migration-seeded email templates
with the source templates inside the same transaction. It verifies record counts
and uses Django's fixture loader to reset PostgreSQL sequences. Do not start API
or background workers until the import finishes. Run the checks
below before opening production traffic:

```bash
python manage.py check --database default --settings=kolekcia.settings.production
python manage.py showmigrations --plan --settings=kolekcia.settings.production
```

Copy uploaded media separately to S3 or the production media volume; database
export does not contain image files.

## 4. Release order

1. Put the old application in maintenance mode and take final backups.
2. Export SQLite and import it into the already-migrated RDS database.
3. Start the API and one Celery worker, then Celery Beat.
4. Verify login, catalog, saved addresses, cart, admin, auctions, and order history.
5. Run one payment only after confirming webhook and reconciliation logs against
   the new database.

Do not run SQLite and PostgreSQL production instances simultaneously: payment
callbacks, stock reservations, auctions, and order status would diverge.
