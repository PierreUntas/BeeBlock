/**
 * Locale-aware navigation helpers from next-intl.
 *
 * Use these instead of `next/link` and `next/navigation` so URLs are
 * automatically prefixed with the current locale when needed (e.g. a
 * German user clicking `/artist` is routed to `/de/artist`).
 */

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
