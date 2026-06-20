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

interface Props {
    snapshot: SubscriptionSnapshot;
}

export default function SubscriptionGate({ snapshot }: Props) {
    const t = useTranslations('SubscriptionGate');
    const locale = useLocale();
    const { getAccessToken } = usePrivy();
    const [busy, setBusy] = useState(false);

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

    async function handleSubscribe() {
        setBusy(true);
        try {
            await openCheckout(getAccessToken);
        } catch (e) {
            console.error(e);
            setBusy(false);
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
            <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 text-center">
                <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-3">
                    {t('freeExhausted.eyebrow')}
                </p>
                <h2 className="text-[clamp(24px,3.5vw,32px)] font-normal text-[#1c1917] leading-tight mb-4">
                    {t('freeExhausted.titleStart')} <em className="italic text-[#78716c]">{t('freeExhausted.titleAccent')}</em>{' '}
                    {t('freeExhausted.titleEnd')}
                </h2>
                <p className="text-[14px] font-light text-[#78716c] max-w-md mx-auto mb-8 leading-[1.7]">
                    {t('freeExhausted.description')}{' '}
                    <strong className="font-medium text-[#1c1917]">{t('freeExhausted.priceHighlight')}</strong>
                    {t('freeExhausted.descriptionEnd')}
                </p>
                <button
                    onClick={handleSubscribe}
                    disabled={busy}
                    className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-10 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                >
                    {busy ? t('freeExhausted.ctaLoading') : t('freeExhausted.cta')}
                </button>
                <p className="text-[11px] text-[#a8a29e] mt-4">
                    {t('freeExhausted.secured')}
                </p>
            </div>
        );
    }

    if (isAtelierExhausted) {
        return (
            <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 text-center">
                <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-3">
                    {t('atelierExhausted.eyebrow')}
                </p>
                <h2 className="text-[clamp(24px,3.5vw,32px)] font-normal text-[#1c1917] leading-tight mb-4">
                    {t('atelierExhausted.titleStart')} <em className="italic text-[#78716c]">{t('atelierExhausted.titleAccent')}</em>{' '}
                    {t('atelierExhausted.titleEnd')}
                </h2>
                <p className="text-[14px] font-light text-[#78716c] max-w-md mx-auto mb-8 leading-[1.7]">
                    {t('atelierExhausted.description')}{' '}
                    {periodEnd && (
                        <>
                            <strong className="font-medium text-[#1c1917]">
                                {t('atelierExhausted.descriptionDate', { date: periodEnd })}
                            </strong>
                        </>
                    )}
                    {t('atelierExhausted.descriptionEnd')}
                </p>
                <button
                    onClick={handleRenew}
                    disabled={busy}
                    className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-10 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                >
                    {busy ? t('atelierExhausted.ctaLoading') : t('atelierExhausted.cta')}
                </button>
                <Link
                    href="/artist/subscription"
                    className="block text-[12px] text-[#a8a29e] hover:text-[#1c1917] underline underline-offset-4 mt-4 transition-colors"
                >
                    {t('atelierExhausted.manageLink')}
                </Link>
            </div>
        );
    }

    // Default informative banner if neither case matches (shouldn't normally render)
    return (
        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 text-center">
            <p className="text-[13px] font-light text-[#78716c]">
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
        <div className="border border-[#d6d0c8] bg-[#ede9e3] px-4 py-3 flex items-center justify-between gap-4">
            <div>
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#a8a29e]">
                    {label}
                    {cancelNotice}
                </p>
                <p className="text-[13px] text-[#1c1917] mt-0.5">
                    <strong className="font-medium">
                        {used} / {limit}
                    </strong>{' '}
                    {t('certified')}{' '}
                    {isAtelier ? t('windowText') : t('lifetimeText')}
                </p>
            </div>
            <Link
                href="/artist/subscription"
                className="text-[11px] font-medium tracking-[0.06em] text-[#78716c] hover:text-[#1c1917] underline underline-offset-4 transition-colors flex-shrink-0"
            >
                {t('manage')}
            </Link>
        </div>
    );
}
