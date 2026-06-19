import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

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

export default withNextIntl(nextConfig);
