'use client';

/**
 * WithdrawalConsentModal — mandatory consent screen shown before redirecting
 * to Stripe Checkout for an Atelier subscription.
 *
 * Why it exists: Article L.221-28 §13° of the French Code de la consommation
 * requires that, for a digital service starting immediately, the consumer
 * expressly waive their 14-day right of withdrawal — AND acknowledge that
 * they lose this right. A pre-checked box or implicit consent is not
 * sufficient (this is the brief juridique §2.1 enforcement).
 *
 * Flow:
 *  1. User clicks "Subscribe to Atelier" on /artist/subscription
 *  2. This modal opens (instead of immediately calling openCheckout)
 *  3. User must read, check the box, AND click "Continue to payment"
 *  4. On confirm: parent component calls openCheckout(..., { withdrawalWaiver: true })
 *     which records the timestamp server-side BEFORE creating the Stripe Session
 *
 * The modal is fully keyboard-accessible (Escape to cancel) and click-outside
 * to dismiss, matching the rest of the site's modal patterns.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface Props {
    open: boolean;
    onConfirm: () => Promise<void> | void;
    onCancel: () => void;
}

export default function WithdrawalConsentModal({ open, onConfirm, onCancel }: Props) {
    const t = useTranslations('Subscription.withdrawalConsent');
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const checkboxRef = useRef<HTMLInputElement>(null);

    // Reset state when the modal is opened/closed.
    useEffect(() => {
        if (open) {
            setAccepted(false);
            setBusy(false);
            setError(null);
            // Small delay to focus after the modal animation
            const id = setTimeout(() => checkboxRef.current?.focus(), 50);
            return () => clearTimeout(id);
        }
    }, [open]);

    // Escape key closes the modal (cancels)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onCancel();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, busy, onCancel]);

    if (!open) return null;

    const handleConfirm = async () => {
        if (!accepted || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onConfirm();
            // Note: on success the parent will redirect to Stripe, so the
            // modal will simply unmount. No need to setBusy(false) here.
        } catch (e) {
            console.error('Withdrawal consent confirm failed:', e);
            setError(t('error'));
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-inverse)]/60 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !busy) onCancel();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-consent-title"
        >
            <div className="bg-[var(--bg-card)] border border-[var(--border)] max-w-lg w-full max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="px-8 pt-7 pb-5">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-5 h-px bg-[var(--border)]" />
                        <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                            Mona Editions
                        </span>
                    </div>
                    <h2
                        id="withdrawal-consent-title"
                        className="text-[24px] font-normal text-[var(--text-primary)] leading-tight mb-4"
                    >
                        {t('title')}
                    </h2>
                    <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.75]">
                        {t('intro')}
                    </p>
                </div>

                {/* Body — checkbox */}
                <div className="px-8 pb-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            ref={checkboxRef}
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            disabled={busy}
                            className="mt-1 w-4 h-4 accent-[var(--text-primary)] cursor-pointer flex-shrink-0"
                        />
                        <span className="text-[13px] font-medium text-[var(--text-primary)] leading-[1.6]">
                            {t('checkboxLabel')}
                        </span>
                    </label>

                    {/* Rights reminder */}
                    <p className="text-[12px] font-light italic text-[var(--text-secondary)] leading-[1.7] mt-5 pl-7">
                        {t('rightsReminder')}
                    </p>

                    {/* Terms link */}
                    <p className="text-[12px] mt-4 pl-7">
                        <Link
                            href="/legal/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#4a5240] underline underline-offset-2 hover:opacity-70 transition-opacity"
                        >
                            {t('termsLink')} ↗
                        </Link>
                    </p>

                    {/* Error display */}
                    {error && (
                        <p className="text-[12px] text-[#dc2626] mt-4 pl-7" role="alert">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer — actions */}
                <div className="border-t border-[var(--border-soft)] px-8 py-5 flex gap-3 justify-end mt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="text-[11px] font-medium tracking-[0.08em] uppercase px-5 py-2 border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all duration-200 disabled:opacity-50 cursor-pointer"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!accepted || busy}
                        className="text-[11px] font-medium tracking-[0.08em] uppercase px-5 py-2 bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] border border-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {busy ? t('confirmLoading') : t('confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}
