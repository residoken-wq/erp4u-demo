/**
 * Convert Google Drive URLs to embeddable/direct image URLs.
 * Supports multiple Google Drive URL formats:
 * - https://drive.google.com/file/d/{ID}/view
 * - https://drive.google.com/open?id={ID}
 * - https://drive.google.com/uc?id={ID}
 * - https://drive.google.com/thumbnail?id={ID}
 * 
 * Returns the URL unchanged if it's not a Google Drive URL.
 */
export function resolveGoogleDriveUrl(url?: string): string {
    if (!url || typeof url !== 'string') return '';

    // Already a direct thumbnail/uc URL → return as-is
    if (url.includes('drive.google.com/thumbnail') || url.includes('googleusercontent.com/d/')) {
        return url;
    }

    // Format: https://drive.google.com/file/d/{FILE_ID}/...
    const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
        return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w800`;
    }

    // Format: https://drive.google.com/open?id={FILE_ID}
    const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch) {
        return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w800`;
    }

    // Format: https://drive.google.com/uc?id={FILE_ID}&...
    const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
    if (ucMatch) {
        return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w800`;
    }

    // Not a Google Drive URL → return unchanged
    return url;
}
