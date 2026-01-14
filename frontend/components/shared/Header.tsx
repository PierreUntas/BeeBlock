"use client";

import { usePrivy } from "@privy-io/react-auth";

const Header = () => {
    const { login, logout, authenticated, user } = usePrivy();

    // Récupérer le premier wallet de l'utilisateur (embedded ou externe)
    const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
    const walletAddress = wallet?.address;

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
                            <span className="text-gray-500 text-xs font-mono">
                                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                            </span>
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