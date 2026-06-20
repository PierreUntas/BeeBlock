/**
 * next-intl routing configuration.
 *
 * Strategy: `localePrefix: 'as-needed'` — the default locale (French) lives
 * at the root (`/artist`), other locales are prefixed (`/de/artist`). This
 * keeps all existing URLs working (critical: QR codes on physical artworks
 * already point to /explore/edition/[id] and must not break).
 *
 * Locale detection happens in middleware.ts: browser Accept-Language is
 * inspected on first visit, then a cookie remembers the user's choice.
 */

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['fr', 'de', 'en'],
    defaultLocale: 'fr',
    localePrefix: 'as-needed',
    localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
