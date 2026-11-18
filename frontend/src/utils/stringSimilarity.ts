/**
 * Tiện ích đo lường độ tương đồng chuỗi và gom nhóm sản phẩm trùng lặp
 * Tối ưu cho tên sản phẩm tiếng Việt (xử lý dấu câu, ký tự đặc biệt, lỗi chính tả, hoán đổi từ)
 */

export interface DuplicateMatch {
    product: any;
    similarity: number; // 0.0 to 1.0 (ví dụ 0.85 = 85%)
}

export interface DuplicateGroup {
    groupId: number;
    groupLabel: string;
    groupColor: string;
    items: any[];
    maxSimilarity: number;
}

export interface DuplicateDetectionResult {
    duplicateProducts: any[];
    groups: DuplicateGroup[];
    totalDuplicates: number;
    totalGroups: number;
}

// Bảng màu cho các nhóm trùng lặp
export const DUPLICATE_GROUP_COLORS = [
    '#1890ff', // Blue
    '#722ed1', // Purple
    '#eb2f96', // Magenta
    '#fa8c16', // Orange
    '#13c2c2', // Cyan
    '#52c41a', // Green
    '#f5222d', // Red
    '#2f54eb', // Geek Blue
    '#faad14', // Gold
    '#a0d911', // Lime
];

/**
 * Loại bỏ dấu tiếng Việt (Accent Stripping)
 */
export const removeVietnameseTones = (str: string): string => {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

/**
 * Chuẩn hóa tên sản phẩm: chuyển chữ thường, loại bỏ ký tự ngăn cách/kích thước, gộp khoảng trắng
 */
export const normalizeProductName = (str: string, stripTones: boolean = false): string => {
    if (!str) return '';
    let text = str.toLowerCase();
    if (stripTones) {
        text = removeVietnameseTones(text);
    }
    // Thay thế các ký tự đặc biệt, dấu câu, ký hiệu kích thước (*, x, -, _, /, +, ...) bằng khoảng trắng
    text = text.replace(/[\s\-_/\\*.,:;+&|()[\]{}#~`!@$%^=<>?"'“”]+/g, ' ');
    return text.trim();
};

/**
 * Tính khoảng cách Levenshtein giữa 2 chuỗi (Dynamic Programming 2 rows - O(min(M, N)) memory)
 */
export const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let v0 = new Array(b.length + 1);
    let v1 = new Array(b.length + 1);

    for (let i = 0; i <= b.length; i++) {
        v0[i] = i;
    }

    for (let i = 0; i < a.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < b.length; j++) {
            const cost = a[i] === b[j] ? 0 : 1;
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= b.length; j++) {
            v0[j] = v1[j];
        }
    }

    return v1[b.length];
};

/**
 * Tỷ lệ tương đồng Levenshtein (0.0 -> 1.0)
 */
export const levenshteinSimilarity = (a: string, b: string): number => {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0.0;
    if (a === b) return 1.0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const dist = levenshteinDistance(a, b);
    return Math.max(0, 1 - dist / maxLen);
};

/**
 * Đo độ tương đồng ký tự qua hệ số Sørensen–Dice trên Character Bigrams (2-gram)
 */
export const diceCoefficient = (a: string, b: string, n: number = 2): number => {
    if (!a || !b) return 0;
    if (a === b) return 1.0;
    if (a.length < n || b.length < n) {
        return a === b ? 1.0 : (a.includes(b) || b.includes(a) ? 0.6 : 0);
    }

    const bigramsA = new Map<string, number>();
    for (let i = 0; i <= a.length - n; i++) {
        const gram = a.slice(i, i + n);
        bigramsA.set(gram, (bigramsA.get(gram) || 0) + 1);
    }

    let intersectionSize = 0;
    for (let i = 0; i <= b.length - n; i++) {
        const gram = b.slice(i, i + n);
        const count = bigramsA.get(gram) || 0;
        if (count > 0) {
            bigramsA.set(gram, count - 1);
            intersectionSize++;
        }
    }

    const totalBigrams = (a.length - n + 1) + (b.length - n + 1);
    return (2.0 * intersectionSize) / totalBigrams;
};

/**
 * Đo mức độ trùng khớp các từ (Token/Word Overlap Jaccard/Dice)
 */
export const wordOverlapSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const wordsA = a.split(' ').filter(w => w.length > 0);
    const wordsB = b.split(' ').filter(w => w.length > 0);
    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    const mapA = new Map<string, number>();
    wordsA.forEach(w => mapA.set(w, (mapA.get(w) || 0) + 1));

    let matched = 0;
    wordsB.forEach(w => {
        const count = mapA.get(w) || 0;
        if (count > 0) {
            mapA.set(w, count - 1);
            matched++;
        }
    });

    return (2.0 * matched) / (wordsA.length + wordsB.length);
};

/**
 * Tính toán độ tương đồng tổng hợp giữa 2 tên sản phẩm
 * Trả về giá trị float trong khoảng [0.0, 1.0]
 */
export const calculateNameSimilarity = (name1: string, name2: string): number => {
    if (!name1 || !name2) return 0;
    const raw1 = name1.trim();
    const raw2 = name2.trim();
    if (raw1.toLowerCase() === raw2.toLowerCase()) return 1.0;

    const norm1 = normalizeProductName(raw1, false);
    const norm2 = normalizeProductName(raw2, false);
    if (!norm1 || !norm2) return 0;
    if (norm1 === norm2) return 1.0;

    // Kiểm tra bao hàm (Substring/Prefix/Suffix containment)
    const isSub = norm1.includes(norm2) || norm2.includes(norm1);
    const subRatio = isSub ? Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length) : 0;

    // So sánh có dấu
    const levAccented = levenshteinSimilarity(norm1, norm2);
    const diceAccented = diceCoefficient(norm1, norm2);
    const wordAccented = wordOverlapSimilarity(norm1, norm2);

    // So sánh không dấu (để bắt các trường hợp gõ thiếu dấu)
    const unaccent1 = normalizeProductName(raw1, true);
    const unaccent2 = normalizeProductName(raw2, true);
    const levUnaccented = levenshteinSimilarity(unaccent1, unaccent2);
    const diceUnaccented = diceCoefficient(unaccent1, unaccent2);
    const wordUnaccented = wordOverlapSimilarity(unaccent1, unaccent2);

    // Điểm có dấu
    const scoreAccented = Math.max(
        levAccented * 0.45 + diceAccented * 0.35 + wordAccented * 0.2,
        subRatio * 0.9,
        wordAccented >= 0.8 ? (wordAccented * 0.6 + diceAccented * 0.4) : 0
    );

    // Điểm không dấu (giảm nhẹ 5% để ưu tiên khớp dấu)
    const scoreUnaccented = Math.max(
        levUnaccented * 0.45 + diceUnaccented * 0.35 + wordUnaccented * 0.2,
        wordUnaccented >= 0.8 ? (wordUnaccented * 0.6 + diceUnaccented * 0.4) : 0
    ) * 0.95;

    const finalScore = Math.max(scoreAccented, scoreUnaccented);
    return Math.min(1.0, Math.max(0, Math.round(finalScore * 100) / 100));
};

export interface DuplicateDetectionOptions {
    threshold?: number; // Ngưỡng tương đồng tối thiểu (0.3 -> 1.0, mặc định 0.5 = 50%)
    sameCategoryOnly?: boolean; // Chỉ so sánh các sản phẩm trong cùng category_id
}

/**
 * Gom cụm các sản phẩm trùng lặp / tương tự nhau
 */
export const findDuplicateProductGroups = (
    products: any[],
    options: DuplicateDetectionOptions = {}
): DuplicateDetectionResult => {
    const threshold = options.threshold !== undefined ? options.threshold : 0.5;
    const sameCategoryOnly = options.sameCategoryOnly || false;

    if (!Array.isArray(products) || products.length < 2) {
        return { duplicateProducts: [], groups: [], totalDuplicates: 0, totalGroups: 0 };
    }

    const n = products.length;
    // Bảng lưu danh sách các sản phẩm tương tự của mỗi sản phẩm (Adjacency list)
    const matchesMap = new Map<number, DuplicateMatch[]>();
    for (let i = 0; i < n; i++) {
        matchesMap.set(products[i].id, []);
    }

    // Đồ thị Union-Find để gom nhóm liên thông
    const parent: number[] = Array.from({ length: n }, (_, i) => i);
    const findRoot = (i: number): number => {
        let root = i;
        while (root !== parent[root]) {
            root = parent[root];
        }
        let curr = i;
        while (curr !== root) {
            const next = parent[curr];
            parent[curr] = root;
            curr = next;
        }
        return root;
    };
    const union = (i: number, j: number) => {
        const rootI = findRoot(i);
        const rootJ = findRoot(j);
        if (rootI !== rootJ) {
            parent[rootJ] = rootI;
        }
    };

    // So sánh từng cặp sản phẩm
    for (let i = 0; i < n; i++) {
        const p1 = products[i];
        if (!p1.name) continue;

        for (let j = i + 1; j < n; j++) {
            const p2 = products[j];
            if (!p2.name) continue;

            if (sameCategoryOnly && p1.category_id && p2.category_id && p1.category_id !== p2.category_id) {
                continue;
            }

            const sim = calculateNameSimilarity(p1.name, p2.name);
            if (sim >= threshold) {
                matchesMap.get(p1.id)!.push({ product: p2, similarity: sim });
                matchesMap.get(p2.id)!.push({ product: p1, similarity: sim });
                union(i, j);
            }
        }
    }

    // Nhóm các index theo root
    const clusterMap = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
        const p = products[i];
        const matches = matchesMap.get(p.id) || [];
        if (matches.length > 0) {
            const root = findRoot(i);
            if (!clusterMap.has(root)) {
                clusterMap.set(root, []);
            }
            clusterMap.get(root)!.push(i);
        }
    }

    // Xây dựng danh sách các Group
    const groups: DuplicateGroup[] = [];
    const duplicateProducts: any[] = [];
    let groupCounter = 1;

    // Sắp xếp các nhóm có nhiều phần tử hoặc có độ trùng cao nhất lên đầu
    const sortedClusters = Array.from(clusterMap.values()).sort((a, b) => b.length - a.length);

    for (const indices of sortedClusters) {
        if (indices.length < 2) continue;

        const groupColor = DUPLICATE_GROUP_COLORS[(groupCounter - 1) % DUPLICATE_GROUP_COLORS.length];
        const groupLabel = `Nhóm #${groupCounter}`;
        const groupId = groupCounter;
        let maxGroupSimilarity = 0;

        const groupItems = indices.map(idx => {
            const prod = products[idx];
            const matches = (matchesMap.get(prod.id) || []).sort((a, b) => b.similarity - a.similarity);
            const maxSim = matches.length > 0 ? matches[0].similarity : 0;
            if (maxSim > maxGroupSimilarity) {
                maxGroupSimilarity = maxSim;
            }

            const decoratedProduct = {
                ...prod,
                duplicateGroupId: groupId,
                duplicateGroupLabel: groupLabel,
                duplicateGroupColor: groupColor,
                duplicateMatches: matches,
                maxSimilarity: maxSim,
            };
            return decoratedProduct;
        });

        // Sắp xếp sản phẩm trong nhóm theo độ tương đồng giảm dần
        groupItems.sort((a, b) => b.maxSimilarity - a.maxSimilarity);

        groups.push({
            groupId,
            groupLabel,
            groupColor,
            items: groupItems,
            maxSimilarity: maxGroupSimilarity,
        });

        duplicateProducts.push(...groupItems);
        groupCounter++;
    }

    return {
        duplicateProducts,
        groups,
        totalDuplicates: duplicateProducts.length,
        totalGroups: groups.length,
    };
};

/**
 * Tìm tất cả sản phẩm tương tự một sản phẩm cụ thể
 */
export const findSimilarProducts = (
    targetProduct: { id?: number; name?: string; sku?: string; category_id?: number },
    allProducts: any[],
    options: DuplicateDetectionOptions = {}
): DuplicateMatch[] => {
    if (!targetProduct?.name || !Array.isArray(allProducts)) return [];
    const threshold = options.threshold !== undefined ? options.threshold : 0.5;
    const sameCategoryOnly = options.sameCategoryOnly || false;

    const matches: DuplicateMatch[] = [];

    for (const p of allProducts) {
        if (targetProduct.id && p.id === targetProduct.id) continue;
        if (targetProduct.sku && p.sku === targetProduct.sku) continue;
        if (!p.name) continue;

        if (sameCategoryOnly && targetProduct.category_id && p.category_id && targetProduct.category_id !== p.category_id) {
            continue;
        }

        const sim = calculateNameSimilarity(targetProduct.name, p.name);
        if (sim >= threshold) {
            matches.push({ product: p, similarity: sim });
        }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
};
