import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

// Points the plugin to our i18n/request.ts config file
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
    webpack: (config, { isServer, webpack }) => {
        config.externals.push('pino-pretty', 'lokijs', 'encoding');

        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };

        // Remplacer les modules React Native par false
        config.resolve.alias = {
            ...config.resolve.alias,
            '@react-native-async-storage/async-storage': false,
            'react-native': false,
        };

        // Ajouter une règle pour ignorer complètement le module
        config.module.rules.push({
            test: /@react-native-async-storage\/async-storage/,
            use: 'null-loader',
        });

        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                'crypto': false,
                'stream': false,
                'http': false,
                'https': false,
                'zlib': false,
            };
        }

        return config;
    },
    transpilePackages: ['@metamask/sdk'],
};

// Compose the plugins: next-intl first, then Sentry wraps the whole thing.
// Sentry's wrapper adds source map upload and edge-runtime instrumentation.
// All Sentry-specific behavior is gated on SENTRY_AUTH_TOKEN being set, so
// builds without Sentry credentials still pass cleanly.
const config = withNextIntl(nextConfig);

export default withSentryConfig(config, {
    // Sentry organization and project slugs (filled when SENTRY_AUTH_TOKEN is set,
    // otherwise these are ignored and source maps simply aren't uploaded).
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Silence build output noise; only show Sentry errors.
    silent: true,

    // Upload source maps only when an auth token is available (in CI/prod).
    // Local builds without the token still work, just without symbolication.
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Hide source maps from the public bundle (still uploaded to Sentry
    // for symbolication, just not served to browsers).
    hideSourceMaps: true,

    // Disable Sentry's automatic instrumentation of Vercel cron jobs
    // (we don't use any, and it adds noise).
    automaticVercelMonitors: false,
});
