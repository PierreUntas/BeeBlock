import type { NextConfig } from "next";

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

export default nextConfig;
