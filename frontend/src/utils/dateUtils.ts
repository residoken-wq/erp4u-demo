import dayjs from 'dayjs';

/**
 * Format date string safely to DD/MM/YYYY
 * Supports Vietnamese date formats (DD/MM/YYYY, DD/MM/YYYY HH:mm:ss),
 * ISO date strings (YYYY-MM-DDTHH:mm:ss.sssZ), and standard dates.
 */
export const formatInvoiceDate = (d: any): string => {
    if (!d) return '-';
    if (typeof d === 'string') {
        const trimmed = d.trim();
        // Match DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
        const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (ddmmyyyy) {
            return `${ddmmyyyy[1].padStart(2, '0')}/${ddmmyyyy[2].padStart(2, '0')}/${ddmmyyyy[3]}`;
        }
        // Match YYYY-MM-DD or ISO string
        const yyyymmdd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (yyyymmdd) {
            return `${yyyymmdd[3].padStart(2, '0')}/${yyyymmdd[2].padStart(2, '0')}/${yyyymmdd[1]}`;
        }
    }
    const parsed = dayjs(d);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY') : String(d);
};
