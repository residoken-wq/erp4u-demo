import React, { useState, useEffect, useRef } from 'react';
import { WizardCategoryL2, WizardOption } from './types';
import { resolveGoogleDriveUrl } from './utils';
import LogoMockupTool from './LogoMockupTool';

const getApiBaseUrl = () => {
    const base = (import.meta as any).env?.VITE_API_BASE_URL || ((import.meta as any).env?.DEV ? 'http://localhost:3000' : '');
    return base.endsWith('/api') ? base.replace(/\/api$/, '') : base;
};

const resolveImageUrl = (url?: string): string => {
    if (!url) return '';
    if (typeof url === 'string' && url.startsWith('/uploads/')) return `${getApiBaseUrl()}/api/upload/files/b2b/${url.replace('/uploads/', '')}`;
    return resolveGoogleDriveUrl(url);
};

// Dùng hình gốc (không watermark) cho các frame layer
const resolveOriginalImageUrl = (url?: string): string => {
    if (!url) return '';
    if (typeof url === 'string' && url.startsWith('/uploads/')) return `${getApiBaseUrl()}/api/upload/files/original/${url.replace('/uploads/', '')}`;
    return resolveGoogleDriveUrl(url);
};

// Guard: chỉ coi là có color_code khi giá trị thực sự hợp lệ (loại trừ #000000 do HTML color picker mặc định)
const hasValidColor = (opt?: WizardOption): boolean => {
    if (!opt?.color_code) return false;
    const c = opt.color_code.trim().toLowerCase();
    return c !== '' && c !== '#000000';
};

// B2B watermark config type
interface WatermarkConfig {
    enabled: boolean;
    position: string;
    opacity: number;
    sizeRatio: number;
    imageFile: string;
}

// Map position string to CSS background-position
const positionToCss: Record<string, string> = {
    'northwest': 'left top', 'north': 'center top', 'northeast': 'right top',
    'west': 'left center', 'center': 'center center', 'east': 'right center',
    'southwest': 'left bottom', 'south': 'center bottom', 'southeast': 'right bottom',
};

interface Props {
    subcategory: WizardCategoryL2;
    selectedOptions: WizardOption[];
    stepSelections?: Record<string, string>; // stepId -> optionId (chính xác, không bị trùng ID)
    imageSelections?: Record<string, number>; // optionId -> selected image index trong image_urls[]
    skippedSteps?: Record<string, boolean>;
}

export default function ProductVisualizer({ subcategory, selectedOptions, stepSelections = {}, imageSelections = {}, skippedSteps = {} }: Props) {
    const visualizerRef = useRef<HTMLDivElement>(null);
    const hasBaseImages = subcategory.base_images && subcategory.base_images.length > 0;
    const legacyBaseImage = subcategory.base_image;

    // Fetch B2B watermark config
    const [wmConfig, setWmConfig] = useState<WatermarkConfig | null>(null);
    useEffect(() => {
        const apiUrl = (import.meta as any).env?.VITE_API_URL || ((import.meta as any).env?.DEV ? 'http://localhost:3000/api' : '/api');
        fetch(`${apiUrl}/upload/watermark/b2b/config`)
            .then(res => res.json())
            .then(data => setWmConfig(data))
            .catch(() => setWmConfig(null));
    }, []);

    const wmImageUrl = wmConfig?.imageFile
        ? `${getApiBaseUrl()}/api/upload/files/${wmConfig.imageFile}`
        : '';

    // Resolve selected option cho mỗi step CHÍNH XÁC bằng stepSelections map
    // Tránh bug: nhiều steps cùng có option id "1", "2"
    const resolveStepOption = (stepId: string): WizardOption | undefined => {
        const step = subcategory.customization_steps?.find(s => s.id === stepId);
        if (!step) return undefined;
        // Bỏ qua nếu step bị skip
        if (skippedSteps[stepId]) return undefined;
        const selectedOptionId = stepSelections[stepId];
        if (!selectedOptionId) return undefined;
        return step.options?.find(o => o.id === selectedOptionId);
    };

    // Check if a yes_no step has selected "Không" (2nd option = hidden)
    const isYesNoHidden = (stepId: string): boolean => {
        const step = subcategory.customization_steps?.find(s => s.id === stepId);
        if (!step || step.type !== 'yes_no') return false;
        const selectedOptionId = stepSelections[stepId];
        // Option thứ 2 (index 1) = "Không" → ẩn
        if (!selectedOptionId) return false;
        const opts = step.options || [];
        return opts.length >= 2 && selectedOptionId === opts[1].id;
    };

    // Lấy tất cả resolved options cho 1 nhóm steps (dùng cho frame mapping)
    // Bỏ qua options từ yes_no steps đã chọn "Không"
    const resolveOptionsForSteps = (steps: typeof subcategory.customization_steps): WizardOption[] => {
        if (!steps) return [];
        return steps
            .filter(step => !isYesNoHidden(step.id) && !skippedSteps[step.id])
            .map(step => resolveStepOption(step.id))
            .filter(Boolean) as WizardOption[];
    };

    // All resolved options (cho floating badges + legacy mode)
    const allResolvedOptions = resolveOptionsForSteps(subcategory.customization_steps || []);

    // Global lookups cho legacy mode + floating badge
    const globalImageSwap = allResolvedOptions.find(o => {
        // Ưu tiên image_urls (multi-image) nếu có
        if (o.image_urls && o.image_urls.length > 0) {
            const idx = imageSelections[o.id] ?? 0;
            return !!o.image_urls[idx];
        }
        return !!o.image_url;
    });
    const globalColor = allResolvedOptions.find(o => hasValidColor(o));
    const globalTexture = allResolvedOptions.find(o => o.visualization_overlay);

    // Helper: resolve image URL for an option, preferring image_urls[selectedIndex] if available
    const resolveOptionImage = (opt: WizardOption): string | undefined => {
        if (opt.image_urls && opt.image_urls.length > 0) {
            const idx = imageSelections[opt.id] ?? 0;
            return opt.image_urls[idx] || opt.image_urls[0];
        }
        return opt.image_url;
    };

    const displayLegacyUrl = globalImageSwap
        ? resolveOriginalImageUrl(resolveOptionImage(globalImageSwap))
        : legacyBaseImage ? resolveOriginalImageUrl(legacyBaseImage) : '';

    return (
        <div ref={visualizerRef} className="relative w-full aspect-square bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 p-4">
            <LogoMockupTool visualizerRef={visualizerRef} />
            {hasBaseImages ? (
                /* Multi-frame layered view */
                <div className="relative w-full h-full flex items-center justify-center">
                    {[...subcategory.base_images!].sort((a, b) => a.sort_order - b.sort_order).map((frame) => {
                        // Steps gắn frame cụ thể + steps KHÔNG gắn frame (global)
                        const mappedSteps = subcategory.customization_steps?.filter(s =>
                            s.required_frame_id === frame.id || !s.required_frame_id
                        ) || [];

                        // Kiểm tra ẩn frame:
                        // 1. Step bị skip
                        // 2. yes_no chọn "Không"
                        // 3. Step is_skippable + chưa có selection → ẩn mặc định cho đến khi chọn
                        const linkedSteps = subcategory.customization_steps?.filter(s =>
                            s.required_frame_id === frame.id
                        ) || [];
                        const isFrameHidden = linkedSteps.some(s => {
                            if (skippedSteps[s.id]) return true;
                            if (s.type === 'yes_no' && isYesNoHidden(s.id)) return true;
                            // Skippable step chưa chọn → ẩn frame cho đến khi khách chọn
                            if (s.is_skippable && !stepSelections[s.id]) return true;
                            return false;
                        });

                        // Resolve options CHÍNH XÁC bằng stepSelections
                        const mappedOptions = resolveOptionsForSteps(mappedSteps);

                        // Ưu tiên: image swap > overlay texture > color tint
                        const swapOption = mappedOptions.find(o => {
                            if (o.image_urls && o.image_urls.length > 0) return true;
                            return !!o.image_url;
                        });
                        const overlayOption = mappedOptions.find(o => o.visualization_overlay);
                        const tintOption = mappedOptions.find(o => hasValidColor(o));

                        // Hình hiển thị: nếu option có image_urls hoặc image_url thì thay thế ảnh gốc frame
                        const swapImageUrl = swapOption ? resolveOptionImage(swapOption) : undefined;
                        // Dùng hình gốc (original) cho frame layers — watermark sẽ phủ lên toàn bộ
                        const displayImageUrl = swapImageUrl
                            ? resolveOriginalImageUrl(swapImageUrl)
                            : resolveOriginalImageUrl(frame.url);

                        return (
                            <div
                                key={frame.id}
                                className="absolute transition-all duration-500"
                                style={{
                                    left: `${(frame.x / 600) * 100}%`,
                                    top: `${(frame.y / 600) * 100}%`,
                                    width: `${(frame.width / 600) * 100}%`,
                                    height: `${(frame.height / 600) * 100}%`,
                                    zIndex: frame.sort_order + 10,
                                    isolation: 'isolate',
                                    opacity: isFrameHidden ? 0 : 1,
                                    transform: isFrameHidden ? 'scale(0.95)' : 'scale(1)',
                                    pointerEvents: isFrameHidden ? 'none' : 'auto',
                                }}
                            >
                                {/* Ảnh hiển thị: swap nếu option có image_url, fallback về frame gốc */}
                                <img 
                                    src={displayImageUrl} 
                                    alt={frame.label || subcategory.name}
                                    className="w-full h-full object-contain transition-all duration-500"
                                    key={displayImageUrl}
                                />

                                {/* Priority 1: Overlay image (texture/pattern) */}
                                {overlayOption && overlayOption.visualization_overlay && (
                                    <img 
                                        src={resolveImageUrl(overlayOption.visualization_overlay)}
                                        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 animate-fade-in"
                                        alt="Texture overlay"
                                        style={{ zIndex: 2 }}
                                    />
                                )}

                                {/* Priority 2: Color tint (chỉ khi không có overlay image và không swap ảnh) */}
                                {/* Tắt chức năng phủ bóng đen (color tint) theo yêu cầu 
                                {!overlayOption && !swapOption && tintOption && hasValidColor(tintOption) && (
                                    <div 
                                        className="absolute inset-0 pointer-events-none transition-colors duration-500"
                                        style={{
                                            backgroundColor: tintOption.color_code,
                                            mixBlendMode: 'multiply',
                                            opacity: 0.6,
                                            zIndex: 2,
                                            WebkitMaskImage: `url('${displayImageUrl}')`,
                                            WebkitMaskSize: 'contain',
                                            WebkitMaskRepeat: 'no-repeat',
                                            WebkitMaskPosition: 'center',
                                            maskImage: `url('${displayImageUrl}')`,
                                            maskSize: 'contain',
                                            maskRepeat: 'no-repeat',
                                            maskPosition: 'center',
                                        }}
                                    />
                                )}
                                */}
                            </div>
                        );
                    })}
                </div>
            ) : legacyBaseImage ? (
                /* Legacy single base_image view */
                <div className="relative w-full h-full flex items-center justify-center" style={{ isolation: 'isolate' }}>
                    <img 
                        src={displayLegacyUrl} 
                        alt={subcategory.name}
                        className="w-full h-full object-contain relative z-10 transition-all duration-500"
                        key={displayLegacyUrl}
                    />
                    
                    {/* Color Tinting Overlay */}
                    {/* Tắt chức năng phủ bóng đen (color tint) theo yêu cầu
                    {!globalImageSwap && globalColor && hasValidColor(globalColor) && (
                        <div 
                            className="absolute inset-0 z-20 pointer-events-none transition-colors duration-500"
                            style={{
                                backgroundColor: globalColor.color_code,
                                mixBlendMode: 'multiply',
                                opacity: 0.6,
                                WebkitMaskImage: `url('${displayLegacyUrl}')`,
                                WebkitMaskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskImage: `url('${displayLegacyUrl}')`,
                                maskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                maskPosition: 'center',
                            }}
                        />
                    )}
                    */}

                    {/* Texture Overlay */}
                    {globalTexture && globalTexture.visualization_overlay && (
                        <img 
                            src={resolveImageUrl(globalTexture.visualization_overlay)}
                            className="absolute inset-0 w-full h-full object-contain z-30 transition-opacity duration-500 animate-fade-in"
                            alt="Texture overlay"
                        />
                    )}
                </div>
            ) : (
                <div className="text-gray-300 text-center">
                    <span className="text-6xl block mb-4">🖼️</span>
                    <p>Chưa có hình ảnh mô phỏng</p>
                </div>
            )}

            {/* Floating Selection Badges */}
            <div className="absolute left-4 top-4 flex flex-col gap-2 z-40">
                {selectedOptions.filter(o => o.name && o.name.length <= 3).map(opt => (
                    <div key={opt.id} className="w-12 h-12 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center text-primary font-bold border border-primary/20 animate-slide-in-right">
                        {opt.name}
                    </div>
                ))}
            </div>
            
            {globalColor && hasValidColor(globalColor) && (
                 <div className="absolute right-4 top-4 z-40">
                    <div 
                        className="w-10 h-10 rounded-full shadow-lg border-2 border-white animate-slide-in-right"
                        style={{ backgroundColor: globalColor.color_code }}
                    />
                 </div>
            )}

            {/* Frame labels (bottom) */}
            {hasBaseImages && (
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1 z-40">
                    {subcategory.base_images!.map(frame => (
                        <div key={frame.id} className="bg-white/80 text-gray-800 border border-gray-200 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm">
                            {frame.label || frame.id}
                        </div>
                    ))}
                </div>
            )}

            {/* Single B2B Watermark overlay — phủ lên toàn bộ visualizer, dùng config từ CMS */}
            {wmConfig?.enabled && wmImageUrl && (
                <div
                    className="absolute inset-0 z-50 pointer-events-none"
                    style={{
                        backgroundImage: `url('${wmImageUrl}')`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: positionToCss[wmConfig.position] || 'center center',
                        backgroundSize: `${Math.round((wmConfig.sizeRatio || 0.25) * 100)}%`,
                        opacity: wmConfig.opacity || 0.25,
                    }}
                />
            )}
        </div>
    );
}
