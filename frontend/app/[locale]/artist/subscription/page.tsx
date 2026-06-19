'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import {
    openCheckout,
    openPortal,
    openRenew,
    useSubscription,
} from '@/app/hooks/useSubscription';

/**
 * Next.js requires components using useSearchParams() to be wrapped in a
 * <Suspense> boundary so the page can be partially prerendered at build time.
 * We split the inner content into its own component for that reason.
 */
export default function ArtistSubscriptionPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#f5f3ef]">
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                        <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">
                            Chargement de votre abonnement…
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
    const { authenticated, getAccessToken, ready } = usePrivy();
    const { snapshot, loading, error, refresh } = useSubscription();
    const params = useSearchParams();
    const [busy, setBusy] = useState(false);

    const justSubscribed = params.get('success') === 'true';
    const justRenewed = params.get('renewed') === 'true';
    const justCanceled = params.get('canceled') === 'true';

    // Refresh once after returning from Stripe so the UI reflects new state
    useEffect(() => {
        if (justSubscribed || justRenewed) {
            const t = setTimeout(() => refresh(), 1500);
            return () => clearTimeout(t);
        }
    }, [justSubscribed, justRenewed, refresh]);

    if (!ready || (!snapshot && loading)) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">
                        Chargement de votre abonnement…
                    </p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="italic text-[22px] text-[#a8a29e]">
                        Veuillez vous connecter
                    </p>
                </div>
            </div>
        );
    }

    const isAtelier = snapshot?.plan === 'atelier' && snapshot.status === 'active';
    const isPastDue = snapshot?.status === 'past_due';
    const periodEnd = snapshot?.currentPeriodEnd
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
        } catch {
            setBusy(false);
        }
    }

    async function handlePortal() {
        setBusy(true);
        try {
            await openPortal(getAccessToken);
        } catch {
            setBusy(false);
        }
    }

    async function handleRenew() {
        setBusy(true);
        try {
            await openRenew(getAccessToken);
        } catch {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions"
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className="text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        Mon <em className="italic text-[#78716c]">abonnement</em>
                    </h1>
                </div>

                {/* Inline status banners after Stripe redirects */}
                {justSubscribed && (
                    <div className="border border-[#d6d0c8] bg-[#ede9e3] p-5 mb-px">
                        <p className="text-[14px] font-medium text-[#1c1917]">
                            Souscription confirmée. Bienvenue dans l'Atelier.
                        </p>
                        <p className="text-[13px] font-light text-[#78716c] mt-1">
                            Si votre quota ne s'est pas encore mis à jour, attendez quelques
                            secondes et rechargez la page.
                        </p>
                    </div>
                )}
                {justRenewed && (
                    <div className="border border-[#d6d0c8] bg-[#ede9e3] p-5 mb-px">
                        <p className="text-[14px] font-medium text-[#1c1917]">
                            Nouvelle période ouverte. Votre quota est remis à zéro pour 30 jours.
                        </p>
                    </div>
                )}
                {justCanceled && (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-5 mb-px">
                        <p className="text-[13px] font-light text-[#78716c]">
                            Opération annulée, aucun changement n'a été effectué.
                        </p>
                    </div>
                )}
                {isPastDue && (
                    <div className="border-2 border-[#dc2626] bg-[#fef2f2] p-5 mb-px">
                        <p className="text-[14px] font-medium text-[#991b1b]">
                            Échec de paiement détecté
                        </p>
                        <p className="text-[13px] font-light text-[#991b1b] mt-1">
                            Mettez à jour votre moyen de paiement depuis l'espace Stripe pour
                            réactiver votre Atelier.
                        </p>
                    </div>
                )}
                {error && (
                    <div className="border border-[#d6d0c8] bg-[#fef2f2] p-5 mb-px">
                        <p className="text-[13px] font-light text-[#991b1b]">
                            Impossible de charger votre abonnement : {error}.
                        </p>
                    </div>
                )}

                {/* Current state */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-3">
                        Palier actuel
                    </p>
                    <h2 className="text-[clamp(28px,4vw,40px)] font-normal text-[#1c1917] leading-tight mb-6">
                        {isAtelier ? (
                            <>
                                <em className="italic text-[#78716c]">Atelier</em>
                                <span className="text-[16px] font-light text-[#78716c] ml-3">
                                    14,90 €/mois
                                </span>
                            </>
                        ) : (
                            <em className="italic text-[#78716c]">Découverte</em>
                        )}
                    </h2>

                    {snapshot && (
                        <div className="space-y-2 mb-6">
                            <p className="text-[13px] font-light text-[#78716c]">
                                <strong className="font-medium text-[#1c1917]">
                                    {snapshot.remainingQuota} / {snapshot.quotaLimit}
                                </strong>{' '}
                                œuvres pouvant encore être certifiées{' '}
                                {isAtelier ? 'cette période' : 'avec le palier Découverte (à vie)'}.
                            </p>
                            {isAtelier && periodEnd && (
                                <p className="text-[13px] font-light text-[#78716c]">
                                    Période en cours jusqu'au{' '}
                                    <strong className="font-medium text-[#1c1917]">
                                        {periodEnd}
                                    </strong>
                                    .
                                </p>
                            )}
                            {snapshot.cancelAtPeriodEnd && (
                                <p className="text-[13px] font-light text-[#dc2626]">
                                    Votre abonnement s'arrêtera à la fin de la période en cours.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    {!isAtelier && (
                        <button
                            onClick={handleSubscribe}
                            disabled={busy}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                        >
                            {busy ? 'Redirection vers Stripe…' : "Passer à l'Atelier — 14,90 €/mois"}
                        </button>
                    )}
                    {isAtelier && (
                        <div className="space-y-2">
                            <button
                                onClick={handlePortal}
                                disabled={busy}
                                className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                            >
                                {busy ? 'Redirection…' : 'Gérer mon abonnement (Stripe)'}
                            </button>
                            <button
                                onClick={handleRenew}
                                disabled={busy}
                                className="w-full bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#d6d0c8] disabled:opacity-50 hover:border-[#1c1917] transition-all duration-200"
                            >
                                Renouveler maintenant (nouvelle période)
                            </button>
                        </div>
                    )}
                </div>

                {/* Plan comparison */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-4">
                        Les deux paliers
                    </p>
                    <div className="space-y-6">
                        <div>
                            <p className="text-[16px] font-medium text-[#1c1917] mb-1">
                                Découverte — gratuit
                            </p>
                            <p className="text-[13px] font-light text-[#78716c] leading-[1.7]">
                                5 œuvres certifiées à vie. Idéal pour démarrer, tester la plateforme
                                ou faire ses premières ventes.
                            </p>
                        </div>
                        <div>
                            <p className="text-[16px] font-medium text-[#1c1917] mb-1">
                                Atelier — 14,90 € / mois
                            </p>
                            <p className="text-[13px] font-light text-[#78716c] leading-[1.7]">
                                50 œuvres certifiées par fenêtre de 30 jours. Renouvelable à tout
                                moment pour repartir avec 50 supplémentaires. Annulable depuis
                                votre espace Stripe.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-10">
                    <Link
                        href="/artist"
                        className="text-[12px] font-medium tracking-[0.06em] text-[#78716c] hover:text-[#1c1917] underline underline-offset-4 transition-colors"
                    >
                        ← Retour à mon profil
                    </Link>
                </div>
            </div>
        </div>
    );
}
