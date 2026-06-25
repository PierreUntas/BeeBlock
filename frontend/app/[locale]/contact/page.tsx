'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { isProduction } from '@/config/constants';

export default function ContactPage() {
    const t = useTranslations('Contact');
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    
    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        sending: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingStates(prev => ({ ...prev, sending: true }));
        setError('');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de l\'envoi');
            }

            setSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setLoadingStates(prev => ({ ...prev, sending: false }));
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 flex-1">

                <div className="text-center mb-12">
                    <img 
                        src="/logo-mona.svg" 
                        alt="Mona Editions Logo" 
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6 dark:invert"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[var(--text-primary)] leading-tight">
                        {t('title')} <em className="italic text-[var(--text-secondary)]">{t('titleAccent')}</em>
                    </h1>
                    <p className="text-[14px] font-light text-[var(--text-secondary)] mt-4 leading-[1.8] max-w-md mx-auto">
                        {t('subtitle')}
                    </p>
                </div>

                {sent ? (
                    <div className="border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center">
                        <p className=" text-[22px] text-[var(--text-primary)] mb-2">{t('success')}</p>
                        <p className="text-[14px] font-light text-[var(--text-secondary)]">{form.email}</p>
                    </div>
                ) : (
                    <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8">
                        {error && (
                            <div className="mb-6 border border-red-300 bg-red-50 p-4 text-center">
                                <p className="text-[13px] text-red-700">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">{t('nameLabel')}</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">{t('emailLabel')}</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">{t('subjectLabel')}</label>
                                <input
                                    type="text"
                                    value={form.subject}
                                    onChange={e => setForm({ ...form, subject: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">{t('messageLabel')}</label>
                                <textarea
                                    value={form.message}
                                    onChange={e => setForm({ ...form, message: e.target.value })}
                                    required
                                    rows={5}
                                    className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors min-h-[140px]"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loadingStates.sending}
                                className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingStates.sending ? t('submitLoading') : t('submit')}
                            </button>
                        </form>
                    </div>
                )}

                <div className="mt-10 border border-[var(--border)] bg-[var(--bg-card)] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-1">{t('directEmailLabel')}</p>
                        <a href="mailto:pierre.untas@gmail.com" className="text-[14px] font-light text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors">
                            pierre.untas@gmail.com
                        </a>
                    </div>
                    <div className="w-px h-8 bg-[var(--border)] hidden md:block" />
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-1">{t('networkLabel')}</p>
                        <p className="text-[14px] font-light text-[var(--text-secondary)]">{isProduction ? 'Base Mainnet · Ethereum L2' : 'Sepolia Testnet · Ethereum'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
