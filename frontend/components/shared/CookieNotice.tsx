'use client';

/**
 * CookieNotice — discreet bottom banner shown on first visit.
 *
 * Mona Editions only uses strictly-necessary technical cookies (no consent
 * required under CNIL 2020-091), but Article 82 of the loi Informatique
 * et Libertés still mandates that users be *informed*. This component
 * fulfills that obligation with a small one-time notice.
 *
 * Persistence: stores acknowledgment in a 365-day cookie named
 * `cookies-ack`. Once dismissed, never shown again unless the cookie
 * is cleared.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const COOKIE_NAME = 'cookies-ack';
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

function hasAcknowledged(): boolean {
    if (typeof document === 'undefined') return true; // SSR: assume yes to avoid flash
    return document.cookie.split(';').some(c => c.trim().startsWith(`${COOKIE_NAME}=`));
}

function setAcknowledged(): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${COOKIE_NAME}=1; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export default function CookieNotice() {
    const t = useTranslations('CookieNotice');
    // Start hidden to avoid SSR/client mismatch flash; flip on after mount.
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!hasAcknowledged()) {
            setVisible(true);
        }
    }, []);

    const dismiss = () => {
        setAcknowledged();
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            role="region"
            aria-label="Cookie notice"
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] border-t border-[#4a4a4a]"
        >
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-[12px] font-light leading-[1.6] flex-1 min-w-[260px] max-w-3xl">
                    {t('message')}{' '}
                    <Link
                        href="/legal/privacy"
                        className="underline underline-offset-2 text-[var(--text-on-inverse)] hover:opacity-80 transition-opacity"
                    >
                        {t('learnMore')} →
                    </Link>
                </p>
                <button
                    type="button"
                    onClick={dismiss}
                    className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--bg-page)] px-4 py-2 hover:bg-[var(--bg-card-alt)] transition-colors duration-200 cursor-pointer whitespace-nowrap"
                >
                    {t('acknowledge')}
                </button>
            </div>
        </div>
    );
}
