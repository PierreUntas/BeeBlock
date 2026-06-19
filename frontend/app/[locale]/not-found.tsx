/**
 * Localized 404 page — rendered for unknown routes inside a valid locale.
 *
 * E.g. /artist/does-not-exist or /de/foo will land here, after the
 * [locale]/layout.tsx provider tree has been set up. Has access to
 * translations and the full Mona Editions chrome (Navbar/Footer via
 * the locale layout).
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
    const t = useTranslations('NotFound');

    return (
        <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center px-6 pt-20 pb-20">
            <div className="text-center max-w-lg">
                <p className="text-[120px] font-light text-[#d6d0c8] leading-none mb-6 tracking-tight">
                    {t('code')}
                </p>
                <h1 className="text-[clamp(28px,4vw,40px)] font-normal text-[#1c1917] mb-4 tracking-[-0.5px]">
                    {t('title')}
                </h1>
                <p className="text-[14px] font-light text-[#78716c] mb-10 leading-[1.7]">
                    {t('subtitle')}
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                    <Link
                        href="/"
                        className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-7 border border-[#1c1917] hover:bg-[#292524] transition-all no-underline"
                    >
                        {t('homeButton')}
                    </Link>
                    <Link
                        href="/explore/editions"
                        className="bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3.5 px-7 border border-[#d6d0c8] hover:border-[#1c1917] transition-all no-underline"
                    >
                        {t('galleryButton')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
