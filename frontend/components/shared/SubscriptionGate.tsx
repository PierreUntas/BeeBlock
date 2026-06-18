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
import Link from 'next/link';
import { openCheckout, openRenew, SubscriptionSnapshot } from '@/app/hooks/useSubscription';

interface Props {
    snapshot: SubscriptionSnapshot;
}

export default function SubscriptionGate({ snapshot }: Props) {
    const { getAccessToken } = usePrivy();
    const [busy, setBusy] = useState(false);

    const isAtelier = snapshot.plan === 'atelier' && snapshot.status === 'active';
    const isFreeExhausted = snapshot.plan === 'free' && snapshot.remainingQuota === 0;
    const isAtelierExhausted = isAtelier && snapshot.remainingQuota === 0;

    const periodEnd = snapshot.currentPeriodEnd
        ? new Date(snapshot.currentPeriodEnd).toLocaleDateString('fr-FR', {
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
                    Quota Découverte atteint
                </p>
                <h2 className="text-[clamp(24px,3.5vw,32px)] font-normal text-[#1c1917] leading-tight mb-4">
                    Vous avez certifié <em className="italic text-[#78716c]">vos 5 œuvres</em>{' '}
                    en palier Découverte
                </h2>
                <p className="text-[14px] font-light text-[#78716c] max-w-md mx-auto mb-8 leading-[1.7]">
                    Pour continuer à certifier librement, passez à l'Atelier :{' '}
                    <strong className="font-medium text-[#1c1917]">14,90 €/mois</strong>,{' '}
                    50 œuvres par fenêtre de 30 jours, annulable à tout moment.
                </p>
                <button
                    onClick={handleSubscribe}
                    disabled={busy}
                    className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-10 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                >
                    {busy ? 'Redirection vers Stripe…' : "Passer à l'Atelier — 14,90 €/mois"}
                </button>
                <p className="text-[11px] text-[#a8a29e] mt-4">
                    Paiement sécurisé par Stripe. Annulable depuis votre espace.
                </p>
            </div>
        );
    }

    if (isAtelierExhausted) {
        return (
            <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 text-center">
                <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-3">
                    Quota du mois atteint
                </p>
                <h2 className="text-[clamp(24px,3.5vw,32px)] font-normal text-[#1c1917] leading-tight mb-4">
                    Vous avez certifié <em className="italic text-[#78716c]">50 œuvres</em>{' '}
                    cette période
                </h2>
                <p className="text-[14px] font-light text-[#78716c] max-w-md mx-auto mb-8 leading-[1.7]">
                    Votre prochaine fenêtre de 30 jours s'ouvre automatiquement{' '}
                    {periodEnd && (
                        <>
                            le <strong className="font-medium text-[#1c1917]">{periodEnd}</strong>.{' '}
                        </>
                    )}
                    Vous pouvez aussi renouveler dès maintenant pour repartir avec 50 nouvelles
                    certifications.
                </p>
                <button
                    onClick={handleRenew}
                    disabled={busy}
                    className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-10 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                >
                    {busy ? 'Redirection vers Stripe…' : 'Renouveler maintenant — 14,90 €'}
                </button>
                <Link
                    href="/artist/subscription"
                    className="block text-[12px] text-[#a8a29e] hover:text-[#1c1917] underline underline-offset-4 mt-4 transition-colors"
                >
                    Gérer mon abonnement
                </Link>
            </div>
        );
    }

    // Default informative banner if neither case matches (shouldn't normally render)
    return (
        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 text-center">
            <p className="text-[13px] font-light text-[#78716c]">
                Votre abonnement actuel ne permet pas de créer une nouvelle œuvre pour le moment.
            </p>
        </div>
    );
}

/**
 * Compact quota indicator to display somewhere visible (e.g. atop the form).
 */
export function QuotaBadge({ snapshot }: { snapshot: SubscriptionSnapshot }) {
    const isAtelier = snapshot.plan === 'atelier' && snapshot.status === 'active';
    const label = isAtelier ? 'Atelier' : 'Découverte';
    const used = isAtelier ? snapshot.periodEditionsUsed : snapshot.freeQuotaUsed;
    const limit = snapshot.quotaLimit;
    const cancelNotice =
        isAtelier && snapshot.cancelAtPeriodEnd ? ' — annulation en fin de période' : '';

    return (
        <div className="border border-[#d6d0c8] bg-[#ede9e3] px-4 py-3 flex items-center justify-between gap-4">
            <div>
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#a8a29e]">
                    Palier {label}
                    {cancelNotice}
                </p>
                <p className="text-[13px] text-[#1c1917] mt-0.5">
                    <strong className="font-medium">
                        {used} / {limit}
                    </strong>{' '}
                    œuvres certifiées{' '}
                    {isAtelier ? '(fenêtre 30 jours)' : '(palier gratuit, à vie)'}
                </p>
            </div>
            <Link
                href="/artist/subscription"
                className="text-[11px] font-medium tracking-[0.06em] text-[#78716c] hover:text-[#1c1917] underline underline-offset-4 transition-colors flex-shrink-0"
            >
                Gérer
            </Link>
        </div>
    );
}
