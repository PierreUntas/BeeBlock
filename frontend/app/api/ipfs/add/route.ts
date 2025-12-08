import { NextRequest, NextResponse } from 'next/server';

const IPFS_API = process.env.IPFS_API_INTERNAL || 'http://78.127.132.196:5001/api/v0';

export async function POST(request: NextRequest) {
    console.log('🚀 IPFS API URL:', IPFS_API);

    try {
        const formData = await request.formData();
        console.log('📦 FormData received');

        const response = await fetch(`${IPFS_API}/add`, {
            method: 'POST',
            body: formData,
        });

        console.log('📡 IPFS Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ IPFS Error:', errorText);
            return NextResponse.json(
                { error: `IPFS error: ${response.statusText}` },
                { status: response.status }
            );
        }

        const result = await response.json();
        console.log('✅ IPFS Result:', result);
        return NextResponse.json(result);
    } catch (error) {
        console.error('💥 IPFS upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload to IPFS', details: String(error) },
            { status: 500 }
        );
    }
}
