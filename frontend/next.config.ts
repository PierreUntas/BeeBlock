import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    webpack: (config, { isServer, webpack }) => {
        config.externals.push('pino-pretty', 'lokijs', 'encoding');

        // Ignorer complètement ces modules pour éviter les warnings
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /@react-native-async-storage\/async-storage/,
            })
        );

        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };

        // Configuration spécifique pour le navigateur
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                '@react-native-async-storage/async-storage': false,
                'react-native': false,
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
