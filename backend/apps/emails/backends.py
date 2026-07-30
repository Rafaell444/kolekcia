"""SMTP backend that works on Windows / OpenSSL 3 strict CA checks."""

from __future__ import annotations

import ssl

from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend


class TrustedSMTPEmailBackend(SMTPEmailBackend):
    """
    Same as Django's SMTP backend, but builds an SSL context that does not
    fail with CERTIFICATE_VERIFY_FAILED (Basic Constraints ... not marked critical)
    which breaks smtp.gmail.com on some Python 3.13 / Windows setups.
    """

    @property
    def ssl_context(self):
        try:
            import truststore

            ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            return ctx
        except Exception:
            pass

        try:
            import certifi

            ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            ctx = ssl.create_default_context()

        if hasattr(ssl, "VERIFY_X509_STRICT"):
            ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
        return ctx
