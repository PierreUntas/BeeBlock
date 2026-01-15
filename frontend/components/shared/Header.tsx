"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

const Header = () => {
    const { login, logout, authenticated, user } = usePrivy();
    const [copied, setCopied] = useState(false);

    // Récupérer le premier wallet de l'utilisateur (embedded ou externe)
    const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
    const walletAddress = (wallet as any)?.address;

    const copyAddress = () => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <nav className="navbar">
            <div className="grow">Logo</div>
            {authenticated ? (
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end text-sm">
                        {user?.email?.address && (
                            <span className="text-gray-700">{user.email.address}</span>
                        )}
                        {walletAddress && (
                            <button
                                onClick={copyAddress}
                                className="text-gray-500 hover:text-gray-700 text-xs font-mono flex items-center gap-1 transition-colors"
                                title="Copier l'adresse"
                            >
                                <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                                <span className="text-[10px]">{copied ? '✓' : '📋'}</span>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={logout}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
                    >
                        Déconnexion
                    </button>
                </div>
            ) : (
                <button
                    onClick={login}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
                >
                    Se connecter
                </button>
            )}
        </nav>
    )
}

export default Header;