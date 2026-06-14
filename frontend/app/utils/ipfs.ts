// Configuration - use API proxy for uploads
const IPFS_API = '/api/ipfs';

// In-memory cache to avoid repeated requests
const ipfsCache = new Map<string, any>();

// Public IPFS gateway (fast and reliable)
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

// Helper function to parse error responses
async function parseErrorResponse(response: Response, defaultMessage: string): Promise<string> {
    let errorMessage = `${defaultMessage}: ${response.statusText}`;
    try {
        const errorData = await response.json();
        if (errorData.error) {
            errorMessage = errorData.error;
        } else if (errorData.details) {
            errorMessage = `${errorData.error || defaultMessage}: ${errorData.details}`;
        }
    } catch {
        try {
            const errorText = await response.text();
            if (errorText) {
                errorMessage = `${defaultMessage}: ${errorText}`;
            }
        } catch {}
    }
    return errorMessage;
}

export async function uploadToIPFS(data: any): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    formData.append('file', blob);

    const response = await fetch(`${IPFS_API}/add`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'IPFS upload error');
        throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.Hash;
}

/**
 * Compress an image in the browser before IPFS upload:
 *  - resize to maxSize px on the longest edge if needed (aspect ratio preserved)
 *  - re-encode as JPEG quality 85%
 *  - pass through SVG (vector) and any non-image file unchanged
 *  - on any processing error, fall back to the original file (never blocking)
 */
async function compressImage(
    file: File,
    maxSize = 2500,
    quality = 0.85
): Promise<File> {
    // Skip non-image
    if (!file.type.startsWith('image/')) return file;
    // SVG: raster compression is not relevant
    if (file.type === 'image/svg+xml') return file;

    try {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('image load failed'));
            img.src = objectUrl;
        });

        const { width, height } = img;
        let targetWidth = width;
        let targetHeight = height;

        if (width > maxSize || height > maxSize) {
            if (width >= height) {
                targetWidth = maxSize;
                targetHeight = Math.round(height * (maxSize / width));
            } else {
                targetHeight = maxSize;
                targetWidth = Math.round(width * (maxSize / height));
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            return file;
        }

        // White background to cleanly flatten transparent PNGs during the JPEG conversion
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        URL.revokeObjectURL(objectUrl);

        const blob: Blob | null = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', quality);
        });

        if (!blob) return file;

        // If compression did not actually shrink the file (already small and well-encoded),
        // keep the original — saves a CPU cycle on the Pinata side.
        if (blob.size >= file.size) return file;

        const baseName = file.name.replace(/\.[^.]+$/, '');
        return new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });
    } catch {
        // On any failure (corrupted image, exotic browser, etc.) we upload the original
        return file;
    }
}

export async function uploadFileToIPFS(file: File): Promise<string> {
    const optimized = await compressImage(file);

    const formData = new FormData();
    formData.append('file', optimized);

    const response = await fetch(`${IPFS_API}/add`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'IPFS file upload error');
        throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.Hash;
}

function cleanCID(cid: string): string {
    return cid
        .replace(/^ipfs:\/\//i, '')
        .replace(/^\/ipfs\//i, '')
        .replace(/^ipfs\//i, '')
        .trim();
}

export async function getFromIPFSGateway(cid: string): Promise<any> {
    const cleanCid = cleanCID(cid);
    if (ipfsCache.has(cleanCid)) {
        return ipfsCache.get(cleanCid);
    }

    const url = `${IPFS_GATEWAY}${cleanCid}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url, {
            cache: 'force-cache',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`IPFS error: ${response.statusText}`);
        }

        const data = await response.json();
        ipfsCache.set(cleanCid, data);
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export function getIPFSUrl(cid: string): string {
    const cleanCid = cleanCID(cid);
    return `${IPFS_GATEWAY}${cleanCid}`;
}

export async function prefetchIPFS(cids: string[]): Promise<void> {
    await Promise.allSettled(cids.map(cid => getFromIPFSGateway(cid)));
}
