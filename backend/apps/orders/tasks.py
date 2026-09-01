"""Background payment jobs.

These are thin schedulers around :mod:`apps.orders.payment_service`; all the
verification and fulfillment rules live there so the webhook and the periodic
job can never disagree about what "paid" means.
"""

from __future__ import annotations

import logging

from celery import shared_task

from .payment_service import expire_stale_payments, reconcile_keepz_payments

logger = logging.getLogger(__name__)

@shared_task(
    name="apps.orders.tasks.reconcile_keepz_payments",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    ignore_result=True,
)
def reconcile_keepz_payments_task(self, limit: int | None = None) -> dict:
    """Recover payments whose Keepz webhook was delayed, lost, or never sent.

    Scheduled every 5 minutes by ``CELERY_BEAT_SCHEDULE``. Each session is
    verified server-to-server and fulfilled through the shared service, so a
    webhook arriving mid-run cannot double-fulfill.
    """
    report = reconcile_keepz_payments(limit=limit)
    if report.skipped:
        logger.info("Keepz reconciliation already running; skipping this tick.")
        return {"skipped": True}
    if report.checked or report.expired:
        logger.info("Keepz reconciliation — %s", report.as_line())
    return {
        "checked": report.checked,
        "updated": report.updated,
        "still_pending": report.still_pending,
        "failed": report.failed,
        "expired": report.expired,
        "needs_review": report.needs_review,
    }


@shared_task(
    name="apps.orders.tasks.expire_stale_keepz_payments",
    ignore_result=True,
)
def expire_stale_keepz_payments_task(max_age_hours: int | None = None) -> int:
    """Abandon payments past the recovery window and free their reserved stock."""
    expired = expire_stale_payments(max_age_hours=max_age_hours)
    if expired:
        logger.info("Expired %s stale Keepz payment(s).", expired)
    return expired
