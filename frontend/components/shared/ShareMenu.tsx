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
    const ref = useRef<HTMLDivElement>(null);

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
        ? 'inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[#fafaf8] border border-[#1c1917] bg-[#1c1917] px-3 py-2 hover:bg-[#292524] transition-all duration-200 cursor-pointer'
        : 'inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[#1c1917] border border-[#d6d0c8] bg-[#f5f3ef] px-3 py-2 hover:border-[#1c1917] transition-all duration-200 cursor-pointer';

    return (
        <div className="relative" ref={ref}>
            <button
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
                    className="absolute right-0 top-full mt-2 z-50 min-w-[200px] bg-[#fafaf8] border border-[#d6d0c8] shadow-sm"
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
            className="block w-full text-left px-4 py-2.5 text-[13px] font-light text-[#1c1917]
                hover:bg-[#f5f3ef] transition-colors duration-150 cursor-pointer
                border-b border-[#e7e3dc] last:border-b-0"
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
            className="block w-full text-left px-4 py-2.5 text-[13px] font-light text-[#1c1917] no-underline
                hover:bg-[#f5f3ef] transition-colors duration-150
                border-b border-[#e7e3dc] last:border-b-0"
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
