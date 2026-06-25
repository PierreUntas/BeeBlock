'use client';

/**
 * ShareMenu — small popover button with copy-link and pre-filled social shares.
 *
 * Used on every "shareable" page: artist profile, collector claim success,
 * edition detail (future). The consumer supplies the text/URL — labels come
 * from a translation namespace it already owns.
 *
 * Falls back to navigator.share on mobile when available, otherwise renders
 * the dropdown menu with explicit share-intent URLs. Instagram has no web
 * share URL; users are expected to copy the link and paste it manually.
 */

import { useEffect, useRef, useState } from 'react';

export interface ShareData {
    /** Text used by X/Twitter intent. Should include the URL. */
    twitterText: string;
    /** URL that platforms (FB) use as the canonical link to share. */
    pageUrl: string;
    /** mailto: subject (will be URL-encoded). */
    emailSubject: string;
    /** mailto: body (will be URL-encoded). */
    emailBody: string;
}

export interface ShareLabels {
    /** Button label when idle, e.g. "Partager". */
    share: string;
    /** Button label when the link has been copied to the clipboard. */
    shareCopied: string;
    /** Menu item label for "copy link". */
    shareCopyLink: string;
    shareTwitter: string;
    shareFacebook: string;
    shareEmail: string;
}

interface ShareMenuProps {
    data: ShareData;
    labels: ShareLabels;
    /** Optional override for the button visual variant. */
    variant?: 'default' | 'inverted';
}

export default function ShareMenu({ data, labels, variant = 'default' }: ShareMenuProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    /**
     * Popover alignment relative to the button. Defaults to right-aligned
     * (popover extends LEFT from the button's right edge) — the historical
     * behaviour, which works when the button sits on the right side of the
     * viewport (e.g. artist profile header).
     *
     * Recomputed on open: if the button is close to the left edge and the
     * popover would clip off-screen, we switch to left-aligned (popover
     * extends RIGHT from the button's left edge).
     */
    const [align, setAlign] = useState<'left' | 'right'>('right');
    const ref = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    // Choose alignment when opening so the popover always fits on screen.
    useEffect(() => {
        if (!open || !buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const POPOVER_MIN_WIDTH = 200; // matches min-w-[200px] below
        const SAFE_MARGIN = 8;
        // Does the popover fit to the right of the button's left edge?
        const fitsLeftAligned =
            rect.left + POPOVER_MIN_WIDTH + SAFE_MARGIN <= window.innerWidth;
        setAlign(fitsLeftAligned ? 'left' : 'right');
    }, [open]);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(data.pageUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Clipboard write failed:', e);
        }
    };

    const links = {
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.twitterText)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.pageUrl)}`,
        email: `mailto:?subject=${encodeURIComponent(data.emailSubject)}&body=${encodeURIComponent(data.emailBody)}`,
    };

    const buttonClass = variant === 'inverted'
        ? 'inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[var(--text-on-inverse)] border border-[var(--text-primary)] bg-[var(--bg-inverse)] px-3 py-2 hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer'
        : 'inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[var(--text-primary)] border border-[var(--border)] bg-[var(--bg-page)] px-3 py-2 hover:border-[var(--text-primary)] transition-all duration-200 cursor-pointer';

    return (
        <div className="relative" ref={ref}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-label={labels.share}
                aria-haspopup="true"
                aria-expanded={open}
                className={buttonClass}
            >
                <ShareIcon />
                <span className="uppercase">{copied ? labels.shareCopied : labels.share}</span>
            </button>

            {open && (
                <div
                    role="menu"
                    className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-2 z-50 min-w-[200px] bg-[var(--bg-card)] border border-[var(--border)] shadow-sm`}
                >
                    <MenuItem onClick={copyLink}>
                        {copied ? `${labels.shareCopied} ✓` : labels.shareCopyLink}
                    </MenuItem>
                    <MenuLink href={links.twitter}>{labels.shareTwitter}</MenuLink>
                    <MenuLink href={links.facebook}>{labels.shareFacebook}</MenuLink>
                    <MenuLink href={links.email}>{labels.shareEmail}</MenuLink>
                </div>
            )}
        </div>
    );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            role="menuitem"
            className="block w-full text-left px-4 py-2.5 text-[13px] font-light text-[var(--text-primary)]
                hover:bg-[var(--bg-page)] transition-colors duration-150 cursor-pointer
                border-b border-[var(--border-soft)] last:border-b-0"
        >
            {children}
        </button>
    );
}

function MenuLink({ children, href }: { children: React.ReactNode; href: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className="block w-full text-left px-4 py-2.5 text-[13px] font-light text-[var(--text-primary)] no-underline
                hover:bg-[var(--bg-page)] transition-colors duration-150
                border-b border-[var(--border-soft)] last:border-b-0"
        >
            {children}
        </a>
    );
}

function ShareIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
    );
}
