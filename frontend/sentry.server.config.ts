/**
 * Sentry Node SDK configuration for API routes and server components.
 * Captures unhandled exceptions thrown server-side during request handling.
 *
 * Reads DSN from SENTRY_DSN (server-only) so it's not exposed to the browser.
 * Falls back to NEXT_PUBLIC_SENTRY_DSN if SENTRY_DSN isn't set, since both
 * are valid (they point to the same project).
 */

import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
    Sentry.init({
        dsn: DSN,
        environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
        tracesSampleRate: process.env.NEXT_PUBLIC_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    });
}
