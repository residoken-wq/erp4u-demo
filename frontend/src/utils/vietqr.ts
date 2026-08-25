export const getVietQRBankCode = (bankName: string | undefined | null): string => {
    if (!bankName) return 'ACB';
    const parts = bankName.split('-');
    const cleanParts = parts.map(p => p.trim());
    
    // 1. Find a part that is all uppercase and no spaces (e.g. ACB, VCB, MB)
    const upperCode = cleanParts.find(p => !p.includes(' ') && /^[A-Z0-9]+$/.test(p));
    if (upperCode) return upperCode;

    // 2. Fallback to any part with no spaces (e.g. MBBank, Vietcombank)
    const singleWord = cleanParts.find(p => !p.includes(' '));
    if (singleWord) return singleWord;

    // 3. Fallback to first uppercase word in the string
    const words = bankName.split(' ');
    const upperWord = words.find(w => /^[A-Z0-9]{2,}$/.test(w));
    if (upperWord) return upperWord;

    // 4. Default to the first part
    return cleanParts[0] || 'ACB';
};
