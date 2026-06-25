/**
 * SubscriptionGate — paywall shown when the artist has no quota left.
 *
 * Three states:
 *  - Free quota exhausted (5/5)            → CTA to subscribe Atelier
 *  - Atelier active but window full (50/50) → CTA to renew immediately
 *  - Atelier canceled but still in period   → informative banner, no action
 *
 * Designed to match the editorial style of Mona Editions (warm beige, serif).
 */

'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { openCheckout, openRenew, SubscriptionSnapshot } from '@/app/hooks/useSubscription';
import WithdrawalConsentModal from './WithdrawalConsentModal';

interface Props {
    snapshot: SubscriptionSnapshot;
}

export default function SubscriptionGate({ snapshot }: Props) {
    const t = useTranslations('SubscriptionGate');
    const locale = useLocale();
    const { getAccessToken } = usePrivy();
    const [busy, setBusy] = useState(false);
    const [consentOpen, setConsentOpen] = useState(false);

    const isAtelier = snapshot.plan === 'atelier' && snapshot.status === 'active';
    const isFreeExhausted = snapshot.plan === 'free' && snapshot.remainingQuota === 0;
    const isAtelierExhausted = isAtelier && snapshot.remainingQuota === 0;

    const periodEnd = snapshot.currentPeriodEnd
        ? new Date(snapshot.currentPeriodEnd).toLocaleDateString(locale === 'de' ? 'de-DE' : 'fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
          })
        : null;

    // The actual subscribe click only opens the consent modal; the real
    // Stripe redirect happens after the user explicitly waives their
    // 14-day right of withdrawal (Code conso L.221-28 §13°).
    function handleSubscribeClick() {
        setConsentOpen(true);
    }

    async function handleConsentConfirm() {
        setBusy(true);
        try {
            await openCheckout(getAccessToken, { withdrawalWaiver: true });
        } catch (e) {
            console.error(e);
            setBusy(false);
            setConsentOpen(false);
            throw e;
        }
    }

    async function handleRenew() {
        setBusy(true);
        try {
            await openRenew(getAccessToken);
        } catch (e) {
            console.error(e);
            setBusy(false);
        }
    }

    if (isFreeExhausted) {
        return (
            <div className="border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center">
                <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-3">
                    {t('freeExhausted.eyebrow')}
                </p>
                <h2 className="text-[clamp(24px,3.5vw,32px)] font-normal text-[var(--text-primary)] leading-tight mb-4">
                    {t('freeExhausted.titleStart')} <em className="italic text-[var(--text-secondary)]">{t('freeExhausted.titleAccent')}</em>{' '}
                    {t('freeExhausted.titleEnd')}
                </h2>
                <p className="text-[14px] font-light text-[var(--text-secondary)] max-w-md mx-auto mb-8 leading-[1.7]">
                    {t('freeExhausted.description')}{' '}
                    <strong className="font-medium text-[var(--text-primary)]">{t('freeExhausted.priceHighlight')}</strong>
                    {t('freeExhausted.descriptionEnd')}
                </p>
                <button
                    onClick={handleSubscribeClick}
                    disabled={busy}
                    className="bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-10 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                >
                    {busy ? t('freeExhausted.ctaLoading') : t('freeExhausted.cta')}
                </button>
                <p className="text-[11px] text-[var(--text-muted)] mt-4">
                    {t('freeExhausted.secured')}
                </p>
                <WithdrawalConsentModal
                    open={consentOpen}
                    onConfirm={handleConsentConfirm}
                    onCancel={() => setConsentOpen(false)}
                />
            </div>
        );
    }

    if (isAtelierExhausted) {
        return (
            <div className="border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center">
                <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-3">
                    {t('atelierExhausted.eyebrow')}
                </p>
                <h2 className="text-[clamp(24px,3.5vw,32px)] font-normal text-[var(--text-primary)] leading-tight mb-4">
                    {t('atelierExhausted.titleStart')} <em className="italic text-[var(--text-secondary)]">{t('atelierExhausted.titleAccent')}</em>{' '}
                    {t('atelierExhausted.titleEnd')}
                </h2>
                <p className="text-[14px] font-light text-[var(--text-secondary)] max-w-md mx-auto mb-8 leading-[1.7]">
                    {t('atelierExhausted.description')}{' '}
                    {periodEnd && (
                        <>
                            <strong className="font-medium text-[var(--text-primary)]">
                                {t('atelierExhausted.descriptionDate', { date: periodEnd })}
                            </strong>
                        </>
                    )}
                    {t('atelierExhausted.descriptionEnd')}
                </p>
                <button
                    onClick={handleRenew}
                    disabled={busy}
                    className="bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-10 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                >
                    {busy ? t('atelierExhausted.ctaLoading') : t('atelierExhausted.cta')}
                </button>
                <Link
                    href="/artist/subscription"
                    className="block text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-4 mt-4 transition-colors"
                >
                    {t('atelierExhausted.manageLink')}
                </Link>
            </div>
        );
    }

    // Default informative banner if neither case matches (shouldn't normally render)
    return (
        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
            <p className="text-[13px] font-light text-[var(--text-secondary)]">
                {t('default.text')}
            </p>
        </div>
    );
}

/**
 * Compact quota indicator to display somewhere visible (e.g. atop the form).
 */
export function QuotaBadge({ snapshot }: { snapshot: SubscriptionSnapshot }) {
    const t = useTranslations('SubscriptionGate.badge');
    const isAtelier = snapshot.plan === 'atelier' && snapshot.status === 'active';
    const label = isAtelier ? t('atelierLabel') : t('freeLabel');
    const used = isAtelier ? snapshot.periodEditionsUsed : snapshot.freeQuotaUsed;
    const limit = snapshot.quotaLimit;
    const cancelNotice =
        isAtelier && snapshot.cancelAtPeriodEnd ? t('cancelNotice') : '';

    return (
        <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] px-4 py-3 flex items-center justify-between gap-4">
            <div>
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)]">
                    {label}
                    {cancelNotice}
                </p>
                <p className="text-[13px] text-[var(--text-primary)] mt-0.5">
                    <strong className="font-medium">
                        {used} / {limit}
                    </strong>{' '}
                    {t('certified')}{' '}
                    {isAtelier ? t('windowText') : t('lifetimeText')}
                </p>
            </div>
            <Link
                href="/artist/subscription"
                className="text-[11px] font-medium tracking-[0.06em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 transition-colors flex-shrink-0"
            >
                {t('manage')}
            </Link>
        </div>
    );
}
