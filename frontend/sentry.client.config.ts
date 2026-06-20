/**
 * Sentry browser SDK configuration.
 * Loaded on every client-side render to capture JS errors, unhandled
 * promise rejections, and (optionally) replays.
 *
 * The DSN comes from NEXT_PUBLIC_SENTRY_DSN, which is exposed at build
 * time so the SDK can be initialized in the browser bundle.
 */

import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
    Sentry.init({
        dsn: DSN,
        environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',

        // Performance monitoring: 10% of transactions are sampled in prod
        // (enough to spot bottlenecks, light on quota).
        tracesSampleRate: process.env.NEXT_PUBLIC_ENVIRONMENT === 'production' ? 0.1 : 1.0,

        // Replays: capture user session video on errors only (saves quota).
        // Sessions where nothing goes wrong are not recorded.
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,

        // Avoid sending obvious noise (extension errors, network blips)
        ignoreErrors: [
            // Browser extensions
            'top.GLOBALS',
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            // Wallet provider noise (Privy / WalletConnect retries)
            'User rejected the request',
            'UserRejectedRequestError',
            // Web3 chain mismatch noise
            'ChainMismatchError',
        ],

        integrations: [
            // Session replay only when an error occurs
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],
    });
}
