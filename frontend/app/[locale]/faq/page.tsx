'use client';

import { useState } from 'react';

const faqs = [
    {
        category: "La plateforme",
        items: [
            {
                q: "Qu'est-ce que Mona Editions ?",
                a: "Mona Editions est une plateforme de certification d'œuvres d'art sur la blockchain Ethereum. Chaque œuvre certifiée reçoit un certificat numérique permanent, infalsifiable et vérifiable par tous."
            },
            {
                q: "Comment fonctionne la certification ?",
                a: "L'artiste crée une édition numérique de son œuvre (titre, année, technique, images…), les données sont stockées sur IPFS et un smart contract Ethereum enregistre la certification. Chaque certificat est un token ERC-1155 unique."
            },
            {
                q: "La blockchain utilisée est-elle fiable ?",
                a: "Oui. Mona Editions utilise le réseau Base, une blockchain Ethereum de couche 2 reconnue pour sa fiabilité et ses faibles frais de transaction. Les données enregistrées sur la blockchain sont immuables et permanentes : elles ne peuvent pas être modifiées ou supprimées."
            },
        ]
    },
    {
        category: "Pour les artistes",
        items: [
            {
                q: "Comment devenir artiste certifié sur Mona Editions ?",
                a: "L'accès artiste est soumis à validation manuelle. Contactez-nous via le formulaire de contact en précisant votre démarche artistique. Notre équipe étudiera votre demande."
            },
            {
                q: "Combien d'exemplaires puis-je certifier pour une œuvre ?",
                a: "Vous choisissez librement la taille de l'édition lors de la création (de 1 à 100 000 exemplaires). Chaque exemplaire est associé à un QR code unique permettant au collectionneur de réclamer son certificat."
            },
            {
                q: "Mes données sont-elles stockées de manière sécurisée ?",
                a: "Les métadonnées de vos œuvres (titre, images, description…) sont stockées sur IPFS, un réseau décentralisé. Seul le CID (identifiant unique) est enregistré sur la blockchain."
            },
        ]
    },
    {
        category: "Pour les collectionneurs",
        items: [
            {
                q: "Comment réclamer mon certificat ?",
                a: "Scannez le QR code fourni par l'artiste avec votre téléphone. Vous serez redirigé vers la page de réclamation. Connectez ou créez un compte, puis réclamez votre certificat en un clic."
            },
            {
                q: "Ai-je besoin d'un wallet crypto ?",
                a: "Non. Mona Editions utilise Privy, qui vous permet de créer un wallet automatiquement via votre email. Aucune connaissance technique n'est requise."
            },
            {
                q: "Que prouve mon certificat ?",
                a: "Votre certificat atteste que vous êtes propriétaire d'un exemplaire authentique de l'œuvre, tel que certifié par l'artiste. Il est vérifiable publiquement sur la blockchain à tout moment."
            },
        ]
    },
];

export default function FaqPage() {
    const [open, setOpen] = useState<string | null>(null);

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
                        Questions <em className="italic text-[#78716c]">fréquentes</em>
                    </h1>
                    <p className="text-[14px] font-light text-[#78716c] mt-4 leading-[1.8]">
                        Tout ce que vous devez savoir sur Mona Editions et la certification d'œuvres.
                    </p>
                </div>

                <div className="space-y-8">
                    {faqs.map((section) => (
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
                    <p className="text-[14px] font-light text-[#78716c] mb-4">Vous n'avez pas trouvé la réponse à votre question ?</p>
                    <a
                        href="/contact"
                        className="inline-block bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-8 border border-[#1c1917] hover:bg-[#292524] transition-all duration-200 no-underline"
                    >
                        Nous contacter
                    </a>
                </div>
            </div>
        </div>
    );
}
