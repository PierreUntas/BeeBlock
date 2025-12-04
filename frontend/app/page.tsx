"use client"

import Image from "next/image";
import Navbar from "../components/shared/Navbar";
import { useState, useEffect } from "react";
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1200);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen  bg-yellow-bee">
            <Navbar />

            {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <Image
                        src="/logo-png-noir.png"
                        alt="Logo"
                        width={200}
                        height={200}
                        className="opacity-70"
                    />
                    <div className="text-6xl font-[Carbon_Phyber] mt-4 text-[#000000]">Bee Block</div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <div className="flex flex-col items-center">
                        <Image
                            src="/logo-png-noir.png"
                            alt="Logo"
                            width={120}
                            height={120}
                            className="opacity-70"
                        />
                        <div className="text-6xl font-[Carbon_Phyber] mt-2 text-[#000000]">Bee Block</div>
                    </div>

                    <div className="flex flex-col items-center mt-16">
                        <h1 className="text-3xl">Bienvenue sur Bee block</h1>
                        <h2 className="text-lg mt-2 font-[Olney_Light]">Suivez votre miel de la ruche au pot.</h2>
                    </div>

                    <div className="mt-20 font-[Olney_Light] opacity-80 hover:opacity-100 transition-opacity">
                        <ConnectButton />
                    </div>
                </div>
            )}
        </div>
    );
}
