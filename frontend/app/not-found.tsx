import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/shared/Navbar';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
                    <div className="mb-8">
                        <Image
                            src="/logo-png-noir.png"
                            alt="Logo"
                            width={150}
                            height={150}
                            className="opacity-70"
                        />
                    </div>
                    
                    <h1 className="text-8xl font-[Carbon_Phyber] text-[#000000] mb-4">
                        404
                    </h1>
                    
                    <h2 className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-4">
                        Page non trouvée
                    </h2>
                    
                    <p className="text-xl font-[Olney_Light] text-[#000000] opacity-70 mb-8 max-w-md">
                        Oups ! Cette page semble avoir disparu comme du miel dans une ruche vide.
                    </p>
                    
                    <div className="flex gap-4 flex-wrap justify-center">
                        <Link
                            href="/"
                            className="px-6 py-3 bg-[#666666] text-yellow-bee font-[Olney_Light] rounded-lg hover:bg-[#333333] transition-all duration-300 border border-[#000000] cursor-pointer"
                        >
                            🏠 Retour à l'accueil
                        </Link>
                        
                        <Link
                            href="/explore"
                            className="px-6 py-3 bg-yellow-bee text-[#000000] font-[Olney_Light] rounded-lg opacity-70 hover:opacity-100 transition-all duration-300 border border-[#000000] cursor-pointer"
                        >
                            🔍 Explorer les lots
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
