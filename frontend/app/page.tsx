"use client"

import { usePrivy } from '@privy-io/react-auth';

export default function Home() {
    const { login, authenticated, user } = usePrivy();

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-[860px] mx-auto px-6 pt-28 pb-20">
                {/* Header */}
                <div className="text-center mb-[72px]">
                    <div className="text-[11px] font-normal tracking-[0.18em] uppercase text-[#a8a29e] mb-5">
                        Plateforme de certification
                    </div>
                    <h1 className=" text-[clamp(40px,6vw,64px)] font-normal tracking-[-1.5px] leading-[1.1] mb-5">
                        Certifier<br />
                        <em className="italic text-[#78716c]">Vos Oeuvres</em>
                    </h1>
                    <p className="text-[15px] font-light leading-[1.8] text-[#78716c] max-w-[520px] mx-auto">
                        Mona Editions est une application qui permet aux artistes de certifier leurs œuvres, de les exposer et de transférer leur propriété de manière simple et sûre, grâce à la blockchain.
                    </p>
                </div>

                {/* Hero CTA */}
                <div className="border border-[#d6d0c8] bg-[#1c1917] mb-6 py-16 px-10 text-center">
                    <div className="text-[10px] font-normal tracking-[0.15em] uppercase text-white/30 mb-6">
                        Bienvenue sur Mona Editions
                    </div>
                    <div className=" text-[clamp(32px,5vw,48px)] font-normal text-white leading-[1.3] mb-5 tracking-[-1px]">
                        Comment fonctionne<br />
                        <em className="italic text-white/40">Mona Editions</em>
                    </div>
                    <div className="text-[14px] font-light text-white/50 max-w-[480px] mx-auto mb-8 leading-[1.75]">
                        Les artistes peuvent enregistrer leurs données professionnelles sur la blockchain, créer des certificats pour leurs œuvres et les partager avec le public. Les collectionneurs, quant à eux, peuvent réclamer un certificat, consulter toutes les œuvres certifiées et gérer celles dont ils deviennent propriétaires.

                        L’application a été pensée pour être particulièrement simple à utiliser : connexion facilitée, transfert de certificats intuitif, interface pensée pour l’univers de l’art.

                        Techniquement, Mona Editions repose sur des smart contracts sécurisés, déployés sur un Layer 2 afin de garantir une utilisation économique, tout en s’adaptant à l’identité visuelle du projet.
                    </div>
                </div>

                {/* Authentication section */}
                {authenticated ? (
                    <>
                        <div className="mb-6 text-center">
                            <a
                                href="/explore/editions"
                                className="text-[12px] font-medium tracking-[0.06em] text-[#fafaf8] no-underline border border-[#1c1917] bg-[#1c1917] py-3.5 px-8 inline-block transition-all duration-200 cursor-pointer hover:bg-[#292524] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(28,25,23,0.25)]"
                            >
                                Explorer les œuvres
                            </a>
                        </div>
                        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-6 mb-6 text-center">
                            <div className="text-[11px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-3">
                                Connecté
                            </div>
                            {user?.email?.address && (
                                <div className="text-[14px] font-normal text-[#1c1917] mb-1.5">
                                    {user.email.address}
                                </div>
                            )}
                            {(() => {
                                const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
                                const walletAddress = (wallet as any)?.address;
                                return walletAddress ? (
                                    <div className="text-[12px] font-mono text-[#78716c]">
                                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    </>
                ) : (
                    <div className="mb-6 text-center">
                        <button
                            onClick={login}
                            className="text-[12px] font-medium tracking-[0.06em] text-[#fafaf8] border border-[#1c1917] bg-[#1c1917] py-3.5 px-8 inline-block transition-all duration-200 cursor-pointer hover:bg-[#292524] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(28,25,23,0.25)]"
                        >
                            Se connecter
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center mt-10">
                    <a
                        href="/about"
                        className="text-[12px] font-normal tracking-[0.06em] text-[#78716c] no-underline border border-[#d6d0c8] py-3 px-7 inline-block transition-all duration-200 hover:border-[#1c1917] hover:text-[#1c1917]"
                    >
                        En savoir plus →
                    </a>
                </div>
            </div>
        </div>
    );
}