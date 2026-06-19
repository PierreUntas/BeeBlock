import PrivyProvider from "@/app/PrivyProvider";
import { ModalProvider } from "@/app/ModalProvider";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing, type Locale } from '@/i18n/routing';
import Layout from "@/components/shared/Layout";

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();

    // Enables static rendering for this locale
    setRequestLocale(locale as Locale);

    // Pass messages to the client so non-server components can call useTranslations()
    const messages = await getMessages();

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <PrivyProvider>
                <ModalProvider>
                    <Layout>
                        {children}
                    </Layout>
                </ModalProvider>
            </PrivyProvider>
        </NextIntlClientProvider>
    );
}
