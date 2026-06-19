'use client';

import { useState, useEffect } from 'react';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient, getDeploymentBlock } from '@/lib/client';

// New artist IPFS structure
interface ArtistIPFSData {
    name: string;
    location: string;
    website: string;
    bio: string;
    logo?: string;
    portfolio: string[];
    exhibitions: string[];
    socialMedia: {
        instagram: string;
        twitter: string;
        facebook: string;
    };
}

interface ArtistInfo {
    address: string;
    name: string;
    location: string;
    metadata: string;
    ipfsData?: ArtistIPFSData;
    editionCount: number;
}

export default function ArtistsPage() {
    const [artists, setArtists] = useState<ArtistInfo[]>([]);
    
    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        fetchingArtists: true,
        loadingIPFS: false,
    });
    
    const [filterArtist, setFilterArtist] = useState<string>('all');

    useEffect(() => {
        const fetchAllArtists = async () => {
            if (!publicClient) { setLoadingStates(prev => ({ ...prev, fetchingArtists: false })); return; }
            try {
                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event ArtistInfoUpdated(address indexed artist)'),
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest'
                });

                const uniqueAddresses = Array.from(new Set(logs.map(l => l.args.artist as string)));

                const artistsData = await Promise.all(uniqueAddresses.map(async (addr) => {
                    const [artistData, editionLogs] = await Promise.all([
                        publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtist', args: [addr as `0x${string}`] }) as Promise<any>,
                        publicClient.getLogs({ address: ARTWORK_REGISTRY_ADDRESS, event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'), args: { artist: addr as `0x${string}` }, fromBlock: getDeploymentBlock(), toBlock: 'latest' })
                    ]);

                    let artistName = 'Artiste anonyme';
                    let artistLocation = 'Non spécifié';
                    if (artistData.metadata?.trim()) {
                        try {
                            const ipfsData = await getFromIPFSGateway(artistData.metadata);
                            artistName = ipfsData.name || 'Artiste anonyme';
                            artistLocation = ipfsData.location || 'Non spécifié';
                        } catch (e) {
                            console.error('Error loading artist IPFS:', e);
                        }
                    }

                    return {
                        address: addr,
                        name: artistName,
                        location: artistLocation,
                        metadata: artistData.metadata || '',
                        editionCount: editionLogs.length
                    };
                }));

                const valid = artistsData
                    .filter(p => p.address) // Afficher tous les artistes enregistrés
                    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

                setArtists(valid);
                setLoadingStates(prev => ({ ...prev, fetchingArtists: false }));

                // Load full IPFS data (bio, portfolio, socialMedia, etc.)
                setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                const ipfsResults = await Promise.all(valid.map(async (p) => {
                    if (!p.metadata?.trim()) return null;
                    try { return { address: p.address, ipfsData: await getFromIPFSGateway(p.metadata) as ArtistIPFSData }; }
                    catch { return null; }
                }));

                setArtists(prev => {
                    const updated = [...prev];
                    ipfsResults.forEach(r => {
                        if (r) { const i = updated.findIndex(p => p.address === r.address); if (i !== -1) updated[i] = { ...updated[i], ipfsData: r.ipfsData }; }
                    });
                    return updated;
                });
                setLoadingStates(prev => ({ ...prev, loadingIPFS: false }));
            } catch (e) {
                console.error('Error loading artists:', e);
                setLoadingStates(prev => ({ ...prev, fetchingArtists: false }));
            }
        };
        fetchAllArtists();
    }, []);

    const filtered = filterArtist === 'all' ? artists : artists.filter(p => p.name === filterArtist);

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-6xl mx-auto px-6 pt-28 pb-20">

                {/* Header */}
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-px bg-[#d6d0c8]" />
                        <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">Explorer</span>
                    </div>
                    <div className="flex items-end justify-between border-b border-[#d6d0c8] pb-8">
                        <div>
                            <h1 className=" text-[clamp(40px,6vw,64px)] font-normal leading-[1.05] tracking-[-1.5px] text-[#1c1917] mb-3">
                                Les <em className="italic text-[#78716c]">artistes</em>
                            </h1>
                            <p className="text-[14px] font-light text-[#78716c] leading-relaxed max-w-md">
                                Découvrez les artistes qui certifient leurs œuvres sur la blockchain.
                                Chaque profil est une identité vérifiée et permanente.
                            </p>
                        </div>
                        <div className="text-right hidden md:block">
                            <span className=" italic text-[48px] text-[#e7e3dc] leading-none">{artists.length}</span>
                            <span className="block text-[11px] font-light tracking-[0.08em] text-[#a8a29e] mt-1">artistes certifiés</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap mb-10">
                    <FilterBtn active={filterArtist === 'all'} onClick={() => setFilterArtist('all')}>
                        Tous ({artists.length})
                    </FilterBtn>
                    {artists.map(p => (
                        <FilterBtn key={p.address} active={filterArtist === p.name} onClick={() => setFilterArtist(p.name)}>
                            {p.name}
                        </FilterBtn>
                    ))}
                </div>

                {loadingStates.loadingIPFS && (
                    <p className="text-[12px] font-light text-[#a8a29e] tracking-[0.06em] mb-6">
                        Chargement des données IPFS…
                    </p>
                )}

                {loadingStates.fetchingArtists ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement des artistes…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-12 text-center">
                        <p className=" italic text-[22px] text-[#a8a29e]">Aucun artiste trouvé</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#d6d0c8] border border-[#d6d0c8]">
                        {filtered.map((artist) => (
                            <Link
                                key={artist.address}
                                href={`/explore/artist/${artist.address}`}
                                className="bg-[#fafaf8] p-6 flex flex-col gap-4 hover:bg-[#f5f3ef] transition-colors duration-200 no-underline group"
                            >
                                {/* First portfolio photo as hero */}
                                {artist.ipfsData?.portfolio?.[0] ? (
                                    <div className="w-full aspect-[16/9] overflow-hidden bg-[#e7e3dc]">
                                        <img
                                            src={ipfsToHttp(artist.ipfsData.portfolio[0])}
                                            alt={artist.name}
                                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full aspect-[16/9] bg-[#e7e3dc] flex items-center justify-center">
                                        <img src="/logo-mona.svg" alt="Logo" className="w-16 h-16 object-contain opacity-20" />
                                    </div>
                                )}

                                {/* Name + logo */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className=" text-[20px] font-normal text-[#1c1917] leading-tight mb-1">
                                            {artist.name}
                                        </h3>
                                        <p className="text-[12px] font-light text-[#78716c]">{artist.location}</p>
                                    </div>
                                    {artist.ipfsData?.logo && (
                                        <img
                                            src={ipfsToHttp(artist.ipfsData.logo)}
                                            alt={`Logo ${artist.name}`}
                                            className="w-14 h-14 object-contain flex-shrink-0 border border-[#e7e3dc] bg-[#f5f3ef]"
                                        />
                                    )}
                                </div>

                                {/* Bio */}
                                {artist.ipfsData?.bio && (
                                    <p className="text-[13px] font-light text-[#78716c] leading-relaxed line-clamp-3">
                                        {artist.ipfsData.bio}
                                    </p>
                                )}

                                {/* Footer */}
                                <div className="border-t border-[#e7e3dc] pt-4 flex items-center justify-between">
                                    <p className="text-[12px] font-light text-[#78716c]">
                                        {artist.editionCount} œuvre{artist.editionCount > 1 ? 's' : ''} certifiée{artist.editionCount > 1 ? 's' : ''}
                                    </p>
                                    {artist.ipfsData?.portfolio && artist.ipfsData.portfolio.length > 1 && (
                                        <p className="text-[11px] font-light text-[#a8a29e]">
                                            {artist.ipfsData.portfolio.length} photos
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Footer mark */}
                <div className="flex justify-center mt-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-px h-12 bg-[#d6d0c8]" />
                        <span className=" italic text-[13px] text-[#a8a29e]">Mona Editions</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`text-[11px] font-medium tracking-[0.06em] px-4 py-2 border transition-all duration-200 cursor-pointer
                ${active
                    ? 'bg-[#1c1917] text-[#f5f3ef] border-[#1c1917]'
                    : 'bg-[#fafaf8] text-[#78716c] border-[#d6d0c8] hover:border-[#1c1917] hover:text-[#1c1917]'
                }`}
        >
            {children}
        </button>
    );
}