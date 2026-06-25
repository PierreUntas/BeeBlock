'use client';

/**
 * ThemeToggle — light / dark mode switcher.
 *
 * Mounts in the Navbar, near the language switcher. Reads/writes the
 * persisted preference in localStorage under the key `mona-theme`. The
 * initial value is applied synchronously by the inline script in
 * app/layout.tsx, so this component just renders the current state and
 * mutates the <html> class on toggle.
 *
 * Visual style: square 32px button matching the language switcher next to
 * it. Sun icon when in dark mode (click → go light), moon icon when in
 * light mode (click → go dark) — the icon represents the *target* state,
 * which is the convention most users recognize.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mona-theme';

type Theme = 'light' | 'dark';

function readInitialTheme(): Theme {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function ThemeToggle() {
    // Mirror the actual <html> state. We initialize to 'light' on the
    // server (no DOM) and re-sync after mount to avoid hydration noise.
    const [theme, setTheme] = useState<Theme>('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setTheme(readInitialTheme());
        setMounted(true);
    }, []);

    const toggle = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch { /* localStorage unavailable, in-memory only */ }
        document.documentElement.classList.toggle('dark', next === 'dark');
    };

    // Render an invisible placeholder during SSR to reserve the same width
    // as the real button. Prevents layout shift between SSR and hydration.
    if (!mounted) {
        return <div className="h-8 w-8" aria-hidden="true" />;
    }

    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            title={isDark ? 'Mode clair' : 'Mode sombre'}
            className="flex items-center justify-center h-8 w-8 border border-[var(--border)] bg-[var(--bg-card)]
                text-[var(--text-primary)] hover:border-[var(--text-primary)]
                transition-all duration-200 cursor-pointer"
        >
            {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
    );
}

/* ─────────────────────────── Icons (inline SVG) ────────────────────── */

function MoonIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    );
}

function SunIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
            <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
    );
}
