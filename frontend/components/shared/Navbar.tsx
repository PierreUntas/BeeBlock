"use client"

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useReadContract } from "wagmi";
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const { login, logout, authenticated, user } = usePrivy();
    const { address } = useAccount();

    // États pour les rôles
    const [isOwner, setIsOwner] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isProducer, setIsProducer] = useState(false);

    // Récupérer le wallet de l'utilisateur
    const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
    const walletAddress = (wallet as any)?.address;

    // Vérifier si l'utilisateur est owner
    const { data: ownerAddress } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'owner',
    });

    // Vérifier si l'utilisateur est admin
    const { data: isAdminResult } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'isAdmin',
        args: address ? [address] : undefined,
    });

    // Vérifier si l'utilisateur est producteur autorisé
    const { data: producerData } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'getProducer',
        args: address ? [address] : undefined,
    });

    // Mettre à jour les rôles
    useEffect(() => {
        if (address && ownerAddress) {
            setIsOwner(address.toLowerCase() === (ownerAddress as string).toLowerCase());
        }
    }, [address, ownerAddress]);

    useEffect(() => {
        if (isAdminResult !== undefined) {
            setIsAdmin(isAdminResult as boolean);
        }
    }, [isAdminResult]);

    useEffect(() => {
        if (producerData) {
            setIsProducer((producerData as any).authorized === true);
        }
    }, [producerData]);

    const copyAddress = () => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <>
            {/* Logo */}
            <div className="fixed top-6 left-6 z-50">
                <img
                    src="/logo-png-noir.png"
                    alt="Logo"
                    className="h-10 w-auto opacity-70"
                />
            </div>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Menu Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-6 right-6 z-50 w-10 h-10 bg-gray-bee/60 rounded-full shadow-xl hover:bg-gray-bee hover:shadow-2xl hover:scale-110 transition-all cursor-pointer border-2 border-black/10 flex items-center justify-center"
            >
                <div className="relative w-5 h-5">
                    <span className={`absolute left-0 top-1.5 block w-5 h-0.5 bg-black transition-all duration-300 ${isOpen ? 'rotate-45 top-2.5' : ''}`}></span>
                    <span className={`absolute left-0 top-2.5 block w-5 h-0.5 bg-black transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`}></span>
                    <span className={`absolute left-0 top-3.5 block w-5 h-0.5 bg-black transition-all duration-300 ${isOpen ? '-rotate-45 top-2.5' : ''}`}></span>
                </div>
            </button>

            {/* Slide Menu */}
            <nav className={`fixed top-0 right-0 h-screen w-80 bg-gray-bee/60 backdrop-blur-md shadow-2xl z-40 transform transition-transform duration-300 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col min-h-full pt-24 pb-8 px-6">
                    {/* Section de connexion */}
                    <div className="mb-6 pb-4 border-b border-black/10">
                        {authenticated ? (
                            <div className="space-y-3">
                                <div className="py-3 px-4 bg-black/5 rounded-lg">
                                    <p className="text-xs font-[Olney_Light] text-black/40 mb-1">CONNECTÉ EN TANT QUE</p>
                                    {user?.email?.address && (
                                        <p className="text-sm text-black font-medium truncate">{user.email.address}</p>
                                    )}
                                    {walletAddress && (
                                        <button
                                            onClick={copyAddress}
                                            className="text-xs text-black/60 hover:text-black font-mono mt-1 flex items-center gap-2 transition-colors w-full"
                                            title="Copier l'adresse complète"
                                        >
                                            <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                                            <span className="text-[10px] ml-auto">{copied ? '✓ Copié' : '📋'}</span>
                                        </button>
                                    )}
                                    {/* Affichage des rôles */}
                                    {(isOwner || isAdmin || isProducer) && (
                                        <div className="mt-2 pt-2 border-t border-black/10">
                                            <p className="text-[10px] text-black/40 mb-1">RÔLES</p>
                                            <div className="flex flex-wrap gap-1">
                                                {isOwner && (
                                                    <span className="text-[10px] bg-purple-400/30 text-purple-900 px-2 py-0.5 rounded">
                                                        Propriétaire
                                                    </span>
                                                )}
                                                {isAdmin && (
                                                    <span className="text-[10px] bg-blue-400/30 text-blue-900 px-2 py-0.5 rounded">
                                                        Administrateur
                                                    </span>
                                                )}
                                                {isProducer && (
                                                    <span className="text-[10px] bg-green-400/30 text-green-900 px-2 py-0.5 rounded">
                                                        Producteur
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        logout();
                                        setIsOpen(false);
                                    }}
                                    className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-500 text-black font-[Olney_Light] font-medium rounded-lg transition-all duration-300 cursor-pointer"
                                >
                                    Déconnexion
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    login();
                                    setIsOpen(false);
                                }}
                                className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-500 text-black font-[Olney_Light] font-medium rounded-lg transition-all duration-300 cursor-pointer"
                            >
                                Se connecter
                            </button>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        {/* Liens publics - toujours visibles */}
                        <a href="/" className="block py-4 px-5 text-black font-[Olney_Light] text-lg hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                            Accueil
                        </a>

                        <a href="/explore" className="block py-4 px-5 text-black font-[Olney_Light] text-lg hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                            Explorer
                        </a>

                        <a href="/about" className="block py-4 px-5 text-black font-[Olney_Light] text-lg hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                            À propos
                        </a>

                        {/* Section Administration - visible seulement pour Owner et Admin */}
                        {(isOwner || isAdmin) && (
                            <>
                                <div className="my-4 border-t border-black/10"></div>
                                <div className="space-y-2">
                                    <p className="text-xs font-[Olney_Light] text-black/40 px-5 mb-2">ADMINISTRATION</p>
                                    
                                    {isOwner && (
                                        <a href="/owner" className="block py-3 px-5 text-black font-[Olney_Light] hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                            Propriétaire
                                        </a>
                                    )}
                                    
                                    {isAdmin && (
                                        <a href="/admin" className="block py-3 px-5 text-black font-[Olney_Light] hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                            Administrateur
                                        </a>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Section Consommateur - visible pour tous les utilisateurs connectés */}
                        {authenticated && (
                            <>
                                <div className="my-4 border-t border-black/10"></div>
                                <div className="space-y-2">
                                    <p className="text-xs font-[Olney_Light] text-black/40 px-5 mb-2">CONSOMMATEUR</p>
                                    <a href="/consumer" className="block py-3 px-5 text-black font-[Olney_Light] hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                        Mes Produits
                                    </a>
                                </div>
                            </>
                        )}

                        {/* Section Producteur - visible seulement pour les producteurs autorisés */}
                        {isProducer && (
                            <>
                                <div className="my-4 border-t border-black/10"></div>
                                <div className="space-y-2">
                                    <p className="text-xs font-[Olney_Light] text-black/40 px-5 mb-2">PRODUCTEUR</p>
                                    <a href="/producer" className="block py-3 px-5 text-black font-[Olney_Light] hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                        Dashboard
                                    </a>
                                    <a href="/producer/batches" className="block py-3 px-5 text-black font-[Olney_Light] text-sm hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                        Mes Lots
                                    </a>
                                    <a href="/producer/batches/create" className="block py-3 px-5 text-black font-[Olney_Light] text-sm hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                        Créer un Lot
                                    </a>
                                </div>
                            </>
                        )}
                    </div>

                </div>
            </nav>
        </>
    );
}