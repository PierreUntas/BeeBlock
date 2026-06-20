/**
 * Next.js instrumentation hook — called once at server start.
 *
 * Loads the Sentry Node config in the Node.js runtime, and the Sentry
 * Edge config in the Edge runtime (middleware). Required by Next.js 15+
 * App Router for server-side Sentry to work.
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
    }
}

/**
 * Forward server-side request errors to Sentry. Required for Next.js
 * App Router error boundaries to be captured properly.
 */
export async function onRequestError(...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) {
    const { captureRequestError } = await import('@sentry/nextjs');
    return captureRequestError(...args);
}
