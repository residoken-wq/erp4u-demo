/**
 * Google Drive URL utility functions
 * Shared across SalesOrderDetail, ProductsPage
 */

/**
 * Extract file ID from Google Drive link and return thumbnail URL
 * @param link - Google Drive file URL
 * @param size - Thumbnail size (default: w200)
 * @returns Thumbnail URL or original link
 */
export const getGoogleDriveImageUrl = (link: string, size: string = 'w200'): string | null => {
    if (!link) return null;
    try {
        let id = '';
        const url = new URL(link);
        if (url.hostname.includes('drive.google.com')) {
            if (url.pathname.includes('/file/d/')) {
                const parts = url.pathname.split('/');
                const idx = parts.indexOf('d');
                if (idx !== -1 && idx + 1 < parts.length) {
                    id = parts[idx + 1];
                }
            } else if (url.searchParams.has('id')) {
                id = url.searchParams.get('id') || '';
            }
        }

        if (id) {
            return `https://drive.google.com/thumbnail?id=${id}&sz=${size}`;
        }
    } catch (e) {
        return null;
    }
    return link;
};

/**
 * Check if a URL is a valid Google Drive link
 */
export const isGoogleDriveUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return parsed.hostname.includes('drive.google.com');
    } catch {
        return false;
    }
};
