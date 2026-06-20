'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface FaqItem { q: string; a: string }
interface FaqSection { category: string; items: FaqItem[] }

export default function FaqPage() {
    const t = useTranslations('Faq');
    const [open, setOpen] = useState<string | null>(null);
    const sections = t.raw('sections') as FaqSection[];

    return (
        <div className="min-h-screen bg-[#f5f3ef] flex flex-col">
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 flex-1">

                <div className="text-center mb-12">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions Logo"
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        {t('title')} <em className="italic text-[#78716c]">{t('titleAccent')}</em>
                    </h1>
                    <p className="text-[14px] font-light text-[#78716c] mt-4 leading-[1.8]">
                        {t('subtitle')}
                    </p>
                </div>

                <div className="space-y-8">
                    {sections.map((section) => (
                        <div key={section.category}>
                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-3 px-1">
                                {section.category}
                            </p>
                            <div className="border border-[#d6d0c8] bg-[#fafaf8] divide-y divide-[#e7e3dc]">
                                {section.items.map((item) => {
                                    const id = `${section.category}-${item.q}`;
                                    const isOpen = open === id;
                                    return (
                                        <div key={item.q}>
                                            <button
                                                onClick={() => setOpen(isOpen ? null : id)}
                                                className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 group"
                                            >
                                                <span className="text-[14px] font-light text-[#1c1917] group-hover:text-[#78716c] transition-colors">
                                                    {item.q}
                                                </span>
                                                <span className={`text-[#a8a29e] flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>
                                                    +
                                                </span>
                                            </button>
                                            {isOpen && (
                                                <div className="px-6 pb-5">
                                                    <p className="text-[13px] font-light text-[#78716c] leading-[1.8]">
                                                        {item.a}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 border border-[#d6d0c8] bg-[#fafaf8] p-6 text-center">
                    <p className="text-[14px] font-light text-[#78716c] mb-4">{t('noResultsPrompt')}</p>
                    <a
                        href="/contact"
                        className="inline-block bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-8 border border-[#1c1917] hover:bg-[#292524] transition-all duration-200 no-underline"
                    >
                        {t('contactButton')}
                    </a>
                </div>
            </div>
        </div>
    );
}
