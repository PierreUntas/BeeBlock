"use client"

import Image from "next/image";
import Navbar from "../components/shared/Navbar";
import { useState, useEffect, useRef } from "react";
import { usePrivy } from '@privy-io/react-auth';

export default function Home() {
    const [isLoading, setIsLoading] = useState(true);
    const [isMobile, setIsMobile] = useState<boolean | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { login, authenticated, user } = usePrivy();

    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setIsMobile(width < 768 || height > width);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleSkip = () => {
        setIsLoading(false);
    };

    const handleVideoEnd = () => {
        setIsLoading(false);
    };

    const toggleSound = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    return (
        <div className="min-h-screen bg-yellow-bee">
            <Navbar />

            {isLoading ? (
                <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
                    {isMobile !== null && (
                        <video
                            ref={videoRef}
                            key={isMobile ? 'mobile' : 'desktop'}
                            autoPlay
                            muted={isMuted}
                            playsInline
                            onEnded={handleVideoEnd}
                            className="absolute inset-0 w-full h-full object-cover"
                        >
                            <source
                                src={isMobile ? "/BEEBLOCK - 9-16.mp4" : "/BEEBLOCK - 16-9.mp4"}
                                type="video/mp4"
                            />
                        </video>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <button
                            onClick={handleSkip}
                            className="px-6 py-3 bg-white/90 hover:bg-white rounded-lg font-[Olney_Light] text-black transition-all shadow-lg cursor-pointer"
                        >
                            Se connecter
                        </button>
                    </div>

                    <button
                        onClick={toggleSound}
                        className="absolute bottom-8 right-8 z-20 transition-all cursor-pointer touch-manipulation"
                        aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
                    >
                        <img
                            src="/icon-mute.webp"
                            alt={isMuted ? "Son coupé" : "Son activé"}
                            className={`w-12 h-12 transition-all ${isMuted ? 'opacity-70' : 'opacity-100 hover:scale-110'}`}
                        />
                    </button>
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

                    <div className="mt-20 font-[Olney_Light]">
                        {authenticated ? (
                            <div className="text-center">
                                <div className="mb-4 space-y-1">
                                    <p className="text-lg font-medium">Connecté en tant que</p>
                                    {user?.email?.address && (
                                        <p className="text-base text-gray-700">{user.email.address}</p>
                                    )}
                                    {(() => {
                                        const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
                                        const walletAddress = wallet?.address;
                                        return walletAddress ? (
                                            <p className="text-sm text-gray-500 font-mono">
                                                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                                            </p>
                                        ) : null;
                                    })()}
                                </div>
                                <a 
                                    href="/explore" 
                                    className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors inline-block"
                                >
                                    Explorer BeeBlock
                                </a>
                            </div>
                        ) : (
                            <button
                                onClick={login}
                                className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
                            >
                                Se connecter
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
