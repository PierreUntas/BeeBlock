import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    webpack: (config, { isServer }) => {
        config.externals.push('pino-pretty', 'lokijs', 'encoding');

        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };

        // Remplacer les modules React Native par des mocks vides
        config.resolve.alias = {
            ...config.resolve.alias,
            '@react-native-async-storage/async-storage': path.resolve(__dirname, 'mocks/empty.js'),
            'react-native': path.resolve(__dirname, 'mocks/empty.js'),
        };

        // Configuration spécifique pour le navigateur
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

        // Exclure les fichiers de test
        config.module.rules.push({
            test: /\.test\.(js|mjs)$/,
            loader: 'ignore-loader'
        });

        return config;
    },
    transpilePackages: ['@metamask/sdk'],
};

export default nextConfig;
