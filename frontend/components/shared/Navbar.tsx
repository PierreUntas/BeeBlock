"use client"

import { useState } from "react";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed top-0 right-0 z-50 p-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex flex-col gap-1.5 p-2 bg-white/60 rounded-lg shadow-sm hover:bg-white/80 transition"
            >
                <span className={`block w-5 h-0.5 bg-[#666666] transition-transform ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                <span className={`block w-5 h-0.5 bg-[#666666] transition-opacity ${isOpen ? 'opacity-0' : ''}`}></span>
                <span className={`block w-5 h-0.5 bg-[#666666] transition-transform ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
            </button>

            {isOpen && (
                <div className="absolute top-14 right-0 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-md min-w-[200px]">
                    <div className="flex flex-col p-2 gap-1">
                        <a href="/" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Home</a>
                        <a href="/owner" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Owner</a>
                        <a href="/admin" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Admin</a>
                        <a href="/explore" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Explore</a>
                        <a href="/explore/batch/1" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Explore Batch</a>
                        <a href="/explore/producer/1" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Explore Producer</a>
                        <a href="/consumer" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Consumer</a>
                        <a href="/consumer/claim" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Consumer Claim</a>
                        <a href="/producer" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Producer</a>
                        <a href="/producer/register" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Producer Register</a>
                        <a href="/producer/batches" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Producer Batches</a>
                        <a href="/producer/batches/create" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">Create Batch</a>
                        <a href="/producer/batches/1" className="p-3 hover:bg-[#666666] hover:text-white rounded-lg transition text-[#000000]">View Batch</a>
                    </div>
                </div>
            )}
        </nav>
    );
}
