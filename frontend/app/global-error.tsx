'use client';

/**
 * Global error boundary — Next.js App Router convention.
 *
 * This file catches React rendering errors that escape from EVERY page
 * (including the root layout). Without it, such errors silently break the
 * UI without being reported to Sentry. Next.js uses this file automatically
 * when a render error bubbles up past every error.tsx boundary.
 *
 * Kept intentionally minimal — it must not rely on any provider (Privy,
 * next-intl, etc.) because the providers themselves might be what crashed.
 */

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="fr">
            <body>
                {/* `NextError` is the default Next.js error page. It's used
                    here instead of a fully custom layout because we have no
                    guarantee that anything else (CSS, providers, translations)
                    is in a working state at this point. */}
                <NextError statusCode={0} />
            </body>
        </html>
    );
}
