'use client';

import { useState } from 'react';
import { isProduction } from '@/config/constants';

export default function ContactPage() {
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
        <div className="min-h-screen bg-[#f5f3ef] flex flex-col">
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 flex-1">

                <div className="text-center mb-12">
                    <img 
                        src="/logo-mona.svg" 
                        alt="Mona Editions Logo" 
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        Nous <em className="italic text-[#78716c]">contacter</em>
                    </h1>
                    <p className="text-[14px] font-light text-[#78716c] mt-4 leading-[1.8] max-w-md mx-auto">
                        Une question, un projet, une demande d'accès artiste ? Nous vous répondons dans les meilleurs délais.
                    </p>
                </div>

                {sent ? (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 text-center">
                        <p className=" text-[22px] text-[#1c1917] mb-2">Message envoyé</p>
                        <p className="text-[14px] font-light text-[#78716c]">Nous vous répondrons à <strong>{form.email}</strong> dans les meilleurs délais.</p>
                    </div>
                ) : (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8">
                        {error && (
                            <div className="mb-6 border border-red-300 bg-red-50 p-4 text-center">
                                <p className="text-[13px] text-red-700">{error}</p>
                            </div>
                        )}
                        
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">Nom *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="Claire Dubois"
                                        required
                                        className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">Email *</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        placeholder="contact@atelier.fr"
                                        required
                                        className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">Sujet *</label>
                                <select
                                    value={form.subject}
                                    onChange={e => setForm({ ...form, subject: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] focus:outline-none focus:border-[#1c1917] transition-colors"
                                >
                                    <option value="">Sélectionner un sujet</option>
                                    <option value="acces-artiste">Demande d'accès artiste</option>
                                    <option value="support">Support technique</option>
                                    <option value="partenariat">Partenariat</option>
                                    <option value="autre">Autre</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">Message *</label>
                                <textarea
                                    value={form.message}
                                    onChange={e => setForm({ ...form, message: e.target.value })}
                                    placeholder="Votre message…"
                                    required
                                    rows={5}
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors min-h-[140px]"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loadingStates.sending}
                                className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] hover:bg-[#292524] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingStates.sending ? 'Envoi en cours…' : 'Envoyer le message'}
                            </button>
                        </form>
                    </div>
                )}

                <div className="mt-10 border border-[#d6d0c8] bg-[#fafaf8] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-1">Email direct</p>
                        <a href="mailto:pierre.untas@gmail.com" className="text-[14px] font-light text-[#1c1917] hover:text-[#78716c] transition-colors">
                            pierre.untas@gmail.com
                        </a>
                    </div>
                    <div className="w-px h-8 bg-[#d6d0c8] hidden md:block" />
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-1">Réseau</p>
                        <p className="text-[14px] font-light text-[#78716c]">{isProduction ? 'Base Mainnet · Ethereum L2' : 'Sepolia Testnet · Ethereum'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
