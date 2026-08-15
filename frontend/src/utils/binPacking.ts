// frontend/src/utils/binPacking.ts

export interface Rect {
    id: string | number;
    w: number;
    h: number;
    x?: number;
    y?: number;
    rotated?: boolean;
    data?: any; // Additional data like color, image URL
}

export interface Bin {
    w: number;
    h: number;
}

// A simple 2D Bin Packing Algorithm using a naive approach for demonstration
// For a production system, a more robust MaxRects or Skyline algorithm is recommended.
export function packRectangles(bin: Bin, rects: Rect[], padding: number = 0, allowRotation: boolean = true): { packed: Rect[], unpacked: Rect[] } {
    // Sort rectangles by area descending (heuristic)
    const sortedRects = [...rects].sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const packed: Rect[] = [];
    const unpacked: Rect[] = [];

    // Keep track of free rectangles (MaxRects approach simplified)
    let freeRects = [{ x: 0, y: 0, w: bin.w, h: bin.h }];

    for (const rect of sortedRects) {
        let placed = false;
        const initialRotated = rect.rotated === true;

        // Sort freeRects by y, then by x to prefer top-left placement (Left-to-Right, Top-to-Bottom packing)
        freeRects.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        // Try to find a free rectangle that fits
        for (let i = 0; i < freeRects.length; i++) {
            const freeRect = freeRects[i];
            const neededW = (initialRotated ? rect.h : rect.w) + padding;
            const neededH = (initialRotated ? rect.w : rect.h) + padding;

            if (neededW <= freeRect.w && neededH <= freeRect.h) {
                // Place it here
                rect.x = freeRect.x;
                rect.y = freeRect.y;
                rect.rotated = initialRotated;
                placed = true;
                packed.push(rect);
                splitFreeRect(freeRect, { x: rect.x, y: rect.y, w: neededW, h: neededH }, freeRects);
                break;
            } else if (allowRotation && !initialRotated) {
                // Try rotated
                const rotatedNeededW = rect.h + padding;
                const rotatedNeededH = rect.w + padding;
                if (rotatedNeededW <= freeRect.w && rotatedNeededH <= freeRect.h) {
                    rect.x = freeRect.x;
                    rect.y = freeRect.y;
                    rect.rotated = true;
                    placed = true;
                    packed.push(rect);
                    splitFreeRect(freeRect, { x: rect.x, y: rect.y, w: rotatedNeededW, h: rotatedNeededH }, freeRects);
                    break;
                }
            }
        }

        if (!placed) {
            unpacked.push(rect);
        }
    }

    return { packed, unpacked };
}

function splitFreeRect(freeRect: any, usedNode: any, freeRects: any[]) {
    // Split the free rectangle into two new free rectangles (Guillotine split heuristic - split along shortest axis)
    const wDiff = freeRect.w - usedNode.w;
    const hDiff = freeRect.h - usedNode.h;

    // Remove the original freeRect
    const index = freeRects.indexOf(freeRect);
    if (index > -1) {
        freeRects.splice(index, 1);
    }

    if (wDiff > 0) {
        freeRects.push({
            x: freeRect.x + usedNode.w,
            y: freeRect.y,
            w: wDiff,
            h: freeRect.h
        });
    }

    if (hDiff > 0) {
        freeRects.push({
            x: freeRect.x,
            y: freeRect.y + usedNode.h,
            w: usedNode.w,
            h: hDiff
        });
    }
}

export interface BinResult {
    binId: string;
    w: number;
    h: number;
    packed: Rect[];
}

export function packMultipleBins(bins: Bin[], rects: Rect[], padding: number = 0, allowRotation: boolean = true): { binResults: BinResult[], unpacked: Rect[] } {
    let currentUnpacked = [...rects];
    const binResults: BinResult[] = [];

    for (let i = 0; i < bins.length; i++) {
        if (currentUnpacked.length === 0) {
            // We still want to add the empty bin to results if user specified it, but it will have empty packed array
            binResults.push({
                binId: `Bin-${i + 1}`,
                w: bins[i].w,
                h: bins[i].h,
                packed: []
            });
            continue;
        }
        
        const bin = bins[i];
        const result = packRectangles(bin, currentUnpacked, padding, allowRotation);
        
        binResults.push({
            binId: `Bin-${i + 1}`,
            w: bin.w,
            h: bin.h,
            packed: result.packed
        });
        
        currentUnpacked = result.unpacked;
    }

    return { binResults, unpacked: currentUnpacked };
}

export interface ContinuousResult {
    width: number;
    totalLength: number; // Max length used (calculated from max Y or max X depending on orientation)
    packed: Rect[];
    unpacked: Rect[];
    wasteArea: number; // Area at the end row that is empty
}

export function packContinuous(fabricWidth: number, rects: Rect[], padding: number = 0, allowRotation: boolean = true): ContinuousResult {
    // Canvas Width (X) = Khổ vải (Fabric Width).
    // Canvas Height (Y) = Chiều dài (Length, infinite).
    // So bin.w = fabricWidth, bin.h = 999999.
    const MAX_LENGTH = 999999;
    const result = packRectangles({ w: fabricWidth, h: MAX_LENGTH }, rects, padding, allowRotation);
    
    let totalLength = 0;
    let totalRectArea = 0;

    for (const rect of result.packed) {
        const rW = rect.rotated ? rect.h : rect.w;
        const rH = rect.rotated ? rect.w : rect.h;
        const bottomEdge = (rect.y || 0) + rH;
        if (bottomEdge > totalLength) {
            totalLength = bottomEdge;
        }
        totalRectArea += (rect.w * rect.h);
    }

    const totalUsedArea = totalLength * fabricWidth;
    const wasteArea = totalUsedArea - totalRectArea;

    return {
        width: fabricWidth,
        totalLength,
        packed: result.packed,
        unpacked: result.unpacked,
        wasteArea: Math.max(0, wasteArea)
    };
}
