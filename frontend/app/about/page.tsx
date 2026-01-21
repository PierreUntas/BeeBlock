import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-yellow-bee">
            <Navbar />
            <div className="container mx-auto px-6 py-20 max-w-4xl">
                <h1 className="text-5xl font-[Carbon_Phyber] text-[#000000] mb-8 text-center">
                    À propos
                </h1>

                <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-8 shadow-xl border-2 border-black/10">
                    <div className="mb-8 rounded-xl overflow-hidden">
                        <Image
                            src="/about-image.jpg"
                            alt="Bee Block Présentation"
                            width={800}
                            height={400}
                            className="w-full h-auto object-cover"
                        />
                    </div>

                    <h2 className="text-3xl font-[Carbon_Phyber] text-[#000000] mb-6">
                        Bee Block – La Ruche Numérique
                    </h2>

                    <div className="space-y-4 font-[Olney_Light] text-lg text-[#000000] leading-relaxed">
                        <p>
                            Bee Block est une DApp de traçabilité du miel qui redonne de la confiance entre apiculteurs et consommateurs.
                        </p>

                        <p>
                            En scannant un simple QR code, vous accédez à l'histoire réelle de votre pot : origine, producteur, lot, contexte de production. Grâce à la blockchain, ces informations clés sont enregistrées de façon infalsifiable, et un petit token utilitaire permet de laisser des avis vérifiés, uniquement après un vrai scan.
                        </p>

                        <p>
                            Bee Block valorise ainsi les producteurs honnêtes, lutte contre le "fake honey" et vous aide à choisir un miel dont vous pouvez vraiment être fier.
                        </p>
                    </div>

                    <div className="flex justify-center mt-12">
                        <Image
                            src="/logo-png-noir.png"
                            alt="Bee Block Logo"
                            width={150}
                            height={150}
                            className="opacity-70"
                        />
                    </div>
                </div>

                <div className="text-center mt-8">
                    <a
                        href="/"
                        className="inline-block px-8 py-3 bg-[#666666] text-white font-[Olney_Light] rounded-lg hover:bg-[#555555] transition-all duration-300 cursor-pointer"
                    >
                        ← Retour à l'accueil
                    </a>
                </div>
            </div>
        </div>
    );
}
