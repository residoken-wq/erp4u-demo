const BANK_MAP = [
    { code: 'ACB', keywords: ['acb', 'á châu', 'a chau'] },
    { code: 'VCB', keywords: ['vietcombank', 'vcb', 'ngoại thương', 'ngoai thuong'] },
    { code: 'TCB', keywords: ['techcombank', 'tcb', 'kỹ thương', 'ky thuong'] },
    { code: 'MB', keywords: ['mbbank', 'mb bank', 'mb', 'quân đội', 'quan doi'] },
    { code: 'ICB', keywords: ['vietinbank', 'ctg', 'công thương', 'cong thuong'] },
    { code: 'BIDV', keywords: ['bidv', 'đầu tư và phát triển', 'dau tu va phat trien'] },
    { code: 'VPB', keywords: ['vpbank', 'vpb', 'thịnh vượng', 'thinh vuong'] },
    { code: 'TPB', keywords: ['tpbank', 'tpb', 'tiên phong', 'tien phong'] },
    { code: 'STB', keywords: ['sacombank', 'stb', 'sài gòn thương tín', 'sai gon thuong tin'] },
    { code: 'HDB', keywords: ['hdbank', 'hdb', 'phát triển tp.hcm', 'phat trien tphcm'] },
    { code: 'VIB', keywords: ['vib', 'quốc tế', 'quoc te'] },
    { code: 'SHB', keywords: ['shb', 'sài gòn - hà nội', 'sai gon ha noi'] },
    { code: 'MSB', keywords: ['msb', 'hàng hải', 'hang hai', 'maritime'] },
    { code: 'LPB', keywords: ['lpbank', 'lpb', 'lienvietpostbank', 'bưu điện liên việt', 'buu dien lien viet'] },
    { code: 'OCB', keywords: ['ocb', 'phương đông', 'phuong dong'] },
    { code: 'BVB', keywords: ['bvbank', 'bvb', 'bản việt', 'ban viet'] },
    { code: 'NAB', keywords: ['namabank', 'nab', 'nam á', 'nam a'] },
    { code: 'BAB', keywords: ['bacabank', 'bab', 'bắc á', 'bac a'] },
    { code: 'ABB', keywords: ['abbank', 'abb', 'an bình', 'an binh'] },
    { code: 'SEAB', keywords: ['seabank', 'seab', 'đông nam á', 'dong nam a'] },
    { code: 'SGB', keywords: ['saigonbank', 'sgb', 'sài gòn công thương', 'sai gon cong thuong'] },
    { code: 'PVCB', keywords: ['pvcombank', 'pvcb', 'đại chúng', 'dai chung'] },
    { code: 'VAB', keywords: ['vietabank', 'vab', 'việt á', 'viet a'] },
    { code: 'VBA', keywords: ['agribank', 'vba', 'nông nghiệp', 'nong nghiep'] }
];

export const getVietQRBankCode = (bankName: string | undefined | null): string => {
    if (!bankName) return 'ACB';

    const lower = bankName.toLowerCase();
    for (const b of BANK_MAP) {
        if (b.keywords.some(k => lower.includes(k))) return b.code;
    }

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
