/**
 * Sentry Edge SDK configuration for middleware and edge runtime.
 * Captures errors that occur in middleware.ts (e.g. locale routing)
 * before requests reach the Node.js server.
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
