"use client"

import { useState } from "react";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
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
            <nav className={`fixed top-0 right-0 h-screen w-80 bg-gray-bee/60 backdrop-blur-md shadow-2xl z-40 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full pt-24 pb-8 px-6">
                    <div className="flex-1 space-y-2">
                        <a href="/" className="block py-4 px-5 text-black font-[Olney_Light] text-lg hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                            Accueil
                        </a>

                        <div className="my-4 border-t border-black/10"></div>

                        <a href="/explore" className="block py-4 px-5 text-black font-[Olney_Light] text-lg hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                            Explorer
                        </a>

                        <div className="my-4 border-t border-black/10"></div>

                        <div className="space-y-2">
                            <p className="text-xs font-[Olney_Light] text-black/40 px-5 mb-2">ADMINISTRATION</p>
                            <a href="/owner" className="block py-3 px-5 text-black font-[Olney_Light] hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                Propriétaire
                            </a>
                            <a href="/admin" className="block py-3 px-5 text-black font-[Olney_Light] hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                Administrateur
                            </a>
                        </div>

                        <div className="my-4 border-t border-black/10"></div>

                        <div className="space-y-2">
                            <p className="text-xs font-[Olney_Light] text-black/40 px-5 mb-2">UTILISATEURS</p>
                            <a href="/consumer" className="block py-3 px-5 text-black font-[Olney_Light] hover:bg-black/10 rounded-xl transition-all cursor-pointer hover:translate-x-2">
                                Consommateur
                            </a>
                        </div>

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
                    </div>
                </div>
            </nav>
        </>
    );
}
