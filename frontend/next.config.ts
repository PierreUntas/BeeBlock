import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    webpack: (config) => {
        config.externals.push('pino-pretty', 'lokijs', 'encoding');

        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };

        // Exclure les fichiers de test
        config.module.rules.push({
            test: /\.test\.(js|mjs)$/,
            loader: 'ignore-loader'
        });

        return config;
    },
};

export default nextConfig;
