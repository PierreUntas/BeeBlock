/**
 * Root not-found page — minimal, no providers needed.
 *
 * Triggered for paths that don't match any route, including invalid
 * locales. Since this page renders OUTSIDE the [locale] segment, it
 * doesn't have access to NextIntlClientProvider, so we keep it static
 * with no translations and no Navbar (the Navbar itself requires
 * translations).
 *
 * The richly styled, localized 404 lives at app/[locale]/not-found.tsx
 * and is shown for unknown pages inside a valid locale.
 */

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-6">
            <div className="text-center max-w-md">
                <p className="text-[80px] font-light text-[var(--border)] leading-none mb-4">404</p>
                <h1 className="text-[24px] font-normal text-[var(--text-primary)] mb-3">
                    Page introuvable / Seite nicht gefunden
                </h1>
                <p className="text-[14px] font-light text-[var(--text-secondary)] mb-8 leading-[1.7]">
                    L'adresse demandée n'existe pas. / Die angeforderte Adresse existiert nicht.
                </p>
                <Link
                    href="/"
                    className="inline-block bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3 px-8 border border-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all no-underline"
                >
                    Mona Editions →
                </Link>
            </div>
        </div>
    );
}
