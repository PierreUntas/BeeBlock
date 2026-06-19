/**
 * Middleware: handles locale routing and detection.
 *
 * Behavior:
 *  - Detects browser Accept-Language on first visit
 *  - Redirects to /de/... if user prefers German, stays on / for French
 *  - Respects NEXT_LOCALE cookie (set when user manually picks a language)
 *  - Skips api/, _next/, public assets
 */

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
    // Match all pathnames except for:
    //  - /api routes (server endpoints, no locale needed)
    //  - /_next, /_vercel internals
    //  - any path containing a dot (e.g. /favicon.ico, /robots.txt)
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
