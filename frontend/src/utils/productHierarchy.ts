// frontend/src/utils/productHierarchy.ts

export interface ProductHierarchyNode {
    product: any;
    level: number;
    parent: any | null;
    children: any[];
    descendants: any[];
    childCount: number;
    totalDescendantCount: number;
}

export interface ProductHierarchyResult {
    rootProducts: any[];
    hierarchyMap: Map<number, ProductHierarchyNode>;
    skuToNodeMap: Map<string, ProductHierarchyNode>;
}

/**
 * Xây dựng cây phả hệ sản phẩm (Gốc -> Biến thể con -> Biến thể cháu)
 * và lọc ra danh sách sản phẩm Level 0 (sản phẩm gốc) có chứa sản phẩm con,
 * loại trừ COMBO và Bán thành phẩm (SEMI_FINISHED).
 */
export function buildProductHierarchy(products: any[]): ProductHierarchyResult {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return {
            rootProducts: [],
            hierarchyMap: new Map(),
            skuToNodeMap: new Map()
        };
    }

    const skuMap = new Map<string, any>();
    const idMap = new Map<number, any>();

    products.forEach(p => {
        if (p.sku) skuMap.set(p.sku, p);
        if (p.id) idMap.set(p.id, p);
    });

    // Chỉ xét các sản phẩm không phải là COMBO
    const candidates = products.filter(p => p.sku && p.product_type !== 'COMBO' && p.product_type !== 'SEMI_FINISHED');

    // Sắp xếp các ứng viên theo độ dài SKU giảm dần để tiền tố dài hơn (cha trực tiếp) được ưu tiên
    const sortedBySkuLenDesc = [...candidates].sort((a, b) => (b.sku || '').length - (a.sku || '').length);

    // Xác định cha trực tiếp của từng sản phẩm: childId -> parentId
    const parentOf = new Map<number, number>();

    candidates.forEach(p => {
        // 1. Kiểm tra nếu product_type trỏ đúng vào một SKU đã tồn tại (khác chính nó)
        if (p.product_type && skuMap.has(p.product_type) && p.product_type !== p.sku) {
            const parent = skuMap.get(p.product_type);
            if (parent.product_type !== 'COMBO' && parent.product_type !== 'SEMI_FINISHED') {
                parentOf.set(p.id, parent.id);
                return;
            }
        }

        // 2. Kiểm tra tiền tố SKU: <Mã_SKU_Cha>_
        for (const potentialParent of sortedBySkuLenDesc) {
            if (potentialParent.id !== p.id && potentialParent.product_type !== 'COMBO' && potentialParent.product_type !== 'SEMI_FINISHED') {
                if (p.sku.startsWith(potentialParent.sku + '_')) {
                    parentOf.set(p.id, potentialParent.id);
                    break;
                }
            }
        }
    });

    // Gom danh sách con trực tiếp: parentId -> [childId]
    const childrenOf = new Map<number, number[]>();
    parentOf.forEach((parentId, childId) => {
        if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
        childrenOf.get(parentId)!.push(childId);
    });

    // Tính toán Level (Level 0: không có cha)
    const levelMap = new Map<number, number>();
    function getLevel(id: number, visited = new Set<number>()): number {
        if (levelMap.has(id)) return levelMap.get(id)!;
        if (visited.has(id)) return 0; // Tránh đệ quy vòng tròn
        visited.add(id);

        const pId = parentOf.get(id);
        if (!pId) {
            levelMap.set(id, 0);
            return 0;
        }

        const lvl = 1 + getLevel(pId, visited);
        levelMap.set(id, lvl);
        return lvl;
    }

    candidates.forEach(p => getLevel(p.id));

    // Thu thập toàn bộ con cháu (descendants) đệ quy
    function getDescendants(id: number, visited = new Set<number>()): any[] {
        if (visited.has(id)) return [];
        visited.add(id);

        const directChildIds = childrenOf.get(id) || [];
        let all: any[] = [];
        for (const cid of directChildIds) {
            const childProd = idMap.get(cid);
            if (childProd) {
                all.push(childProd);
                all = all.concat(getDescendants(cid, visited));
            }
        }
        return all;
    }

    const hierarchyMap = new Map<number, ProductHierarchyNode>();
    const skuToNodeMap = new Map<string, ProductHierarchyNode>();

    candidates.forEach(p => {
        const directChildIds = childrenOf.get(p.id) || [];
        const directChildren = directChildIds.map(cid => idMap.get(cid)).filter(Boolean);
        const descendants = getDescendants(p.id);
        const parentProd = parentOf.has(p.id) ? idMap.get(parentOf.get(p.id)!) || null : null;

        const node: ProductHierarchyNode = {
            product: p,
            level: levelMap.get(p.id) || 0,
            parent: parentProd,
            children: directChildren,
            descendants: descendants,
            childCount: directChildren.length,
            totalDescendantCount: descendants.length
        };

        hierarchyMap.set(p.id, node);
        skuToNodeMap.set(p.sku, node);
    });

    // Lọc các sản phẩm Level 0 có sản phẩm con (và không phải Combo/BTP)
    const rootProducts = candidates
        .filter(p => {
            const lvl = levelMap.get(p.id) || 0;
            const children = childrenOf.get(p.id) || [];
            return lvl === 0 && children.length > 0;
        })
        .map(p => {
            const node = hierarchyMap.get(p.id)!;
            return {
                ...p,
                hierarchyLevel: node.level,
                childCount: node.childCount,
                totalDescendantCount: node.totalDescendantCount,
                children: node.children,
                descendants: node.descendants
            };
        })
        .sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));

    return {
        rootProducts,
        hierarchyMap,
        skuToNodeMap
    };
}

/**
 * Kiểm tra xem một sản phẩm gốc hoặc bất kỳ sản phẩm con/biến thể nào của nó có khớp với từ khóa tìm kiếm hay không.
 */
export function matchesHierarchySearch(rootProduct: any, descendants: any[], searchText: string): boolean {
    if (!searchText || !searchText.trim()) return true;
    const lower = searchText.trim().toLowerCase();

    // 1. Khớp thông tin sản phẩm gốc
    if ((rootProduct.name && rootProduct.name.toLowerCase().includes(lower)) ||
        (rootProduct.sku && rootProduct.sku.toLowerCase().includes(lower))) {
        return true;
    }

    // 2. Khớp thông tin bất kỳ sản phẩm con nào
    if (descendants && Array.isArray(descendants)) {
        for (const child of descendants) {
            if ((child.name && child.name.toLowerCase().includes(lower)) ||
                (child.sku && child.sku.toLowerCase().includes(lower))) {
                return true;
            }
            // Khớp thuộc tính biến thể (attributes)
            if (child.attributes && typeof child.attributes === 'object') {
                const attrValues = Object.values(child.attributes).join(' ').toLowerCase();
                if (attrValues.includes(lower)) return true;
            }
        }
    }

    return false;
}
