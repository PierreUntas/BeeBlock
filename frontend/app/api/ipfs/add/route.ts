import { NextRequest, NextResponse } from 'next/server';

const IPFS_API = process.env.IPFS_API_INTERNAL || 'http://78.127.132.196:5001/api/v0';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const response = await fetch(`${IPFS_API}/add`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `IPFS error: ${response.statusText}` },
                { status: response.status }
            );
        }

        const result = await response.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('IPFS upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload to IPFS' },
            { status: 500 }
        );
    }
}
