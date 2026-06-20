/**
 * LegalPage — rendering shell for the static legal markdown documents.
 *
 * Reads the markdown content at build time (server component) and renders
 * it with the Mona Editions design tokens (warm beige, serif headings).
 *
 * Used by /legal/mentions, /legal/privacy, /legal/terms.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { marked } from 'marked';
import { getLocale, getTranslations } from 'next-intl/server';

interface Props {
    /** Filename inside frontend/content/legal/, e.g. 'mentions.md' */
    file: string;
    /** Title shown in the page header (separate from the H1 inside the doc) */
    title: string;
    /** Italic accent shown after the title, e.g. 'légales' */
    accent: string;
}

export default async function LegalPage({ file, title, accent }: Props) {
    const filePath = path.join(process.cwd(), 'content', 'legal', file);
    const md = await fs.readFile(filePath, 'utf8');

    // marked.parse is synchronous when given a string; cast to handle the
    // overloaded async signature without await.
    const html = marked.parse(md, { async: false }) as string;

    const locale = await getLocale();
    const tLegal = await getTranslations('Legal');

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions"
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className="text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        {title} <em className="italic text-[#78716c]">{accent}</em>
                    </h1>
                </div>

                {locale === 'de' && (
                    <div className="border-2 border-[#d97706] bg-[#fef3c7] p-5 mb-px">
                        <p className="text-[13px] font-medium text-[#92400e] mb-1">
                            {tLegal('deDisclaimer.title')}
                        </p>
                        <p className="text-[12px] font-light text-[#92400e] leading-[1.7]">
                            {tLegal('deDisclaimer.body')}
                        </p>
                    </div>
                )}

                <article
                    className="border border-[#d6d0c8] bg-[#fafaf8] p-8 md:p-12 legal-prose"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>

            <style>{`
                .legal-prose h1 { display: none; }
                .legal-prose h2 {
                    font-size: 22px;
                    font-weight: 500;
                    color: #1c1917;
                    margin: 32px 0 12px 0;
                    letter-spacing: -0.3px;
                    line-height: 1.3;
                }
                .legal-prose h2:first-child { margin-top: 0; }
                .legal-prose h3 {
                    font-size: 16px;
                    font-weight: 500;
                    color: #1c1917;
                    margin: 24px 0 8px 0;
                }
                .legal-prose p {
                    font-size: 14px;
                    line-height: 1.75;
                    color: #1c1917;
                    margin: 0 0 14px 0;
                    font-weight: 300;
                }
                .legal-prose ul, .legal-prose ol {
                    font-size: 14px;
                    line-height: 1.75;
                    color: #1c1917;
                    font-weight: 300;
                    padding-left: 22px;
                    margin: 0 0 18px 0;
                }
                .legal-prose li { margin-bottom: 6px; }
                .legal-prose strong { color: #1c1917; font-weight: 500; }
                .legal-prose em { color: #78716c; font-style: italic; }
                .legal-prose a {
                    color: #1c1917;
                    text-decoration: underline;
                    text-underline-offset: 3px;
                }
                .legal-prose a:hover { text-decoration: none; }
                .legal-prose code {
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 12.5px;
                    background: #ede9e3;
                    padding: 1px 6px;
                    border-radius: 3px;
                    color: #1c1917;
                }
                .legal-prose blockquote {
                    border-left: 2px solid #d6d0c8;
                    padding-left: 16px;
                    margin: 16px 0;
                    color: #78716c;
                    font-style: italic;
                }
                .legal-prose table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 16px 0 22px 0;
                    font-size: 13px;
                }
                .legal-prose th,
                .legal-prose td {
                    text-align: left;
                    padding: 10px 12px;
                    border: 1px solid #d6d0c8;
                    vertical-align: top;
                    line-height: 1.6;
                    color: #1c1917;
                    font-weight: 300;
                }
                .legal-prose th {
                    background: #ede9e3;
                    font-weight: 500;
                    font-size: 11px;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: #78716c;
                }
                .legal-prose hr {
                    border: 0;
                    border-top: 1px solid #d6d0c8;
                    margin: 32px 0;
                }
            `}</style>
        </div>
    );
}
