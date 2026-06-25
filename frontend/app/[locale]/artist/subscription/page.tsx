'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
    openCheckout,
    openPortal,
    openRenew,
    useSubscription,
} from '@/app/hooks/useSubscription';
import WithdrawalConsentModal from '@/components/shared/WithdrawalConsentModal';

export default function ArtistSubscriptionPage() {
    const t = useTranslations('Subscription');
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[var(--bg-page)]">
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                        <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">
                            {t('loading')}
                        </p>
                    </div>
                </div>
            }
        >
            <ArtistSubscriptionPageInner />
        </Suspense>
    );
}

function ArtistSubscriptionPageInner() {
    const t = useTranslations('Subscription');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const { authenticated, getAccessToken, ready } = usePrivy();
    const { snapshot, loading, error, refresh } = useSubscription();
    const params = useSearchParams();
    const [busy, setBusy] = useState(false);
    const [consentOpen, setConsentOpen] = useState(false);

    const justSubscribed = params.get('success') === 'true';
    const justRenewed = params.get('renewed') === 'true';
    const justCanceled = params.get('canceled') === 'true';

    useEffect(() => {
        if (justSubscribed || justRenewed) {
            const tid = setTimeout(() => refresh(), 1500);
            return () => clearTimeout(tid);
        }
    }, [justSubscribed, justRenewed, refresh]);

    if (!ready || (!snapshot && loading)) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">
                        {t('loading')}
                    </p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="italic text-[22px] text-[var(--text-muted)]">
                        {tCommon('connect')}
                    </p>
                </div>
            </div>
        );
    }

    const isAtelier = snapshot?.plan === 'atelier' && snapshot.status === 'active';
    const isPastDue = snapshot?.status === 'past_due';
    const periodEnd = snapshot?.currentPeriodEnd
        ? new Date(snapshot.currentPeriodEnd).toLocaleDateString(locale === 'de' ? 'de-DE' : 'fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
          })
        : null;

    // The subscribe button only opens the withdrawal consent modal. The
    // actual Stripe redirect happens in handleConsentConfirm below, after
    // the user has explicitly waived their 14-day right of withdrawal
    // (Code conso L.221-28 §13°).
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

    async function handlePortal() {
        setBusy(true);
        try { await openPortal(getAccessToken); }
        catch { setBusy(false); }
    }

    async function handleRenew() {
        setBusy(true);
        try { await openRenew(getAccessToken); }
        catch { setBusy(false); }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-page)]">
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions"
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6 dark:invert"
                    />
                    <h1 className="text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[var(--text-primary)] leading-tight">
                        {t('title')} <em className="italic text-[var(--text-secondary)]">{t('titleAccent')}</em>
                    </h1>
                </div>

                {justSubscribed && (
                    <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-5 mb-px">
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{t('banners.subscribed')}</p>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] mt-1">{t('banners.subscribedHint')}</p>
                    </div>
                )}
                {justRenewed && (
                    <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-5 mb-px">
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{t('banners.renewed')}</p>
                    </div>
                )}
                {justCanceled && (
                    <div className="border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-px">
                        <p className="text-[13px] font-light text-[var(--text-secondary)]">{t('banners.canceled')}</p>
                    </div>
                )}
                {isPastDue && (
                    <div className="border-2 border-[#dc2626] bg-[#fef2f2] p-5 mb-px">
                        <p className="text-[14px] font-medium text-[#991b1b]">{t('banners.pastDue')}</p>
                        <p className="text-[13px] font-light text-[#991b1b] mt-1">{t('banners.pastDueHint')}</p>
                    </div>
                )}
                {error && (
                    <div className="border border-[var(--border)] bg-[#fef2f2] p-5 mb-px">
                        <p className="text-[13px] font-light text-[#991b1b]">{t('banners.loadError', { error })}</p>
                    </div>
                )}

                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-3">
                        {t('current.eyebrow')}
                    </p>
                    <h2 className="text-[clamp(28px,4vw,40px)] font-normal text-[var(--text-primary)] leading-tight mb-6">
                        {isAtelier ? (
                            <>
                                <em className="italic text-[var(--text-secondary)]">{t('current.ateliersLabel')}</em>
                                <span className="text-[16px] font-light text-[var(--text-secondary)] ml-3">
                                    {t('current.ateliersPrice')}
                                </span>
                            </>
                        ) : (
                            <em className="italic text-[var(--text-secondary)]">{t('current.discoveryLabel')}</em>
                        )}
                    </h2>

                    {snapshot && (
                        <div className="space-y-2 mb-6">
                            <p className="text-[13px] font-light text-[var(--text-secondary)]">
                                <strong className="font-medium text-[var(--text-primary)]">
                                    {snapshot.remainingQuota} / {snapshot.quotaLimit}
                                </strong>{' '}
                                {isAtelier ? t('current.remainingSuffixAtelier') : t('current.remainingSuffixFree')}
                            </p>
                            {isAtelier && periodEnd && (
                                <p className="text-[13px] font-light text-[var(--text-secondary)]">
                                    {t('current.periodEnding')}{' '}
                                    <strong className="font-medium text-[var(--text-primary)]">{periodEnd}</strong>.
                                </p>
                            )}
                            {snapshot.cancelAtPeriodEnd && (
                                <p className="text-[13px] font-light text-[#dc2626]">
                                    {t('current.cancelNotice')}
                                </p>
                            )}
                        </div>
                    )}

                    {!isAtelier && (
                        <button
                            onClick={handleSubscribeClick}
                            disabled={busy}
                            className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                        >
                            {busy ? t('actions.subscribeLoading') : t('actions.subscribe')}
                        </button>
                    )}
                    {isAtelier && (
                        <div className="space-y-2">
                            <button
                                onClick={handlePortal}
                                disabled={busy}
                                className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                            >
                                {busy ? t('actions.manageLoading') : t('actions.manage')}
                            </button>
                            <button
                                onClick={handleRenew}
                                disabled={busy}
                                className="w-full bg-[var(--bg-page)] text-[var(--text-primary)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--border)] disabled:opacity-50 hover:border-[var(--text-primary)] transition-all duration-200"
                            >
                                {t('actions.renew')}
                            </button>
                        </div>
                    )}
                </div>

                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-4">
                        {t('plans.title')}
                    </p>
                    <div className="space-y-6">
                        <div>
                            <p className="text-[16px] font-medium text-[var(--text-primary)] mb-1">{t('plans.discoveryName')}</p>
                            <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7]">{t('plans.discoveryDescription')}</p>
                        </div>
                        <div>
                            <p className="text-[16px] font-medium text-[var(--text-primary)] mb-1">{t('plans.atelierName')}</p>
                            <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7]">{t('plans.atelierDescription')}</p>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-10">
                    <Link
                        href="/artist"
                        className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 transition-colors"
                    >
                        {t('backToProfile')}
                    </Link>
                </div>

                {/* Withdrawal consent modal — mounted at root so it overlays
                    the whole page when triggered by the subscribe button. */}
                <WithdrawalConsentModal
                    open={consentOpen}
                    onConfirm={handleConsentConfirm}
                    onCancel={() => setConsentOpen(false)}
                />
            </div>
        </div>
    );
}
