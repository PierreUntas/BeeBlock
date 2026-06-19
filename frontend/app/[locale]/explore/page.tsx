'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExplorePage() {
    const router = useRouter();
    
    useEffect(() => {
        router.push('/explore/editions');
    }, [router]);

    return null;
}
