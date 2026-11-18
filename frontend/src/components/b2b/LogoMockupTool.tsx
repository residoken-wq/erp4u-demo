'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import html2canvas from 'html2canvas';

interface Props {
    visualizerRef: React.RefObject<HTMLDivElement>;
}

export default function LogoMockupTool({ visualizerRef }: Props) {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [processedLogoUrl, setProcessedLogoUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [blendMode, setBlendMode] = useState<'normal' | 'multiply' | 'overlay'>('multiply');
    const [opacity, setOpacity] = useState(0.85);
    const [removeTolerance, setRemoveTolerance] = useState(240); // Tolerance for white background removal
    const [logoColor, setLogoColor] = useState<'original' | 'white' | 'black'>('original');
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Process image with Canvas to remove white background and apply color overlays
    const processImage = (imgUrl: string, tolerance: number, colorMode: 'original' | 'white' | 'black') => {
        setIsProcessing(true);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // If pixel is brighter than tolerance (close to white), make it transparent
                if (r >= tolerance && g >= tolerance && b >= tolerance) {
                    data[i + 3] = 0;
                } else if (data[i + 3] > 0) {
                    // Apply color overlay for non-transparent pixels
                    if (colorMode === 'white') {
                        data[i] = 255;     // R
                        data[i + 1] = 255; // G
                        data[i + 2] = 255; // B
                    } else if (colorMode === 'black') {
                        data[i] = 0;       // R
                        data[i + 1] = 0;   // G
                        data[i + 2] = 0;   // B
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    setProcessedLogoUrl(URL.createObjectURL(blob));
                }
                setIsProcessing(false);
            }, 'image/png');
        };
        img.onerror = () => {
            console.error("Failed to load image into canvas");
            setIsProcessing(false);
        };
        img.src = imgUrl;
    };

    // Re-process when tolerance or color changes
    useEffect(() => {
        if (logoUrl) {
            processImage(logoUrl, removeTolerance, logoColor);
        }
    }, [removeTolerance, logoColor]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        setLogoUrl(objectUrl);
        processImage(objectUrl, removeTolerance, logoColor);
    };


    const handleExport = async () => {
        if (!visualizerRef.current) return;
        setIsExporting(true);
        const originalPanelState = isPanelOpen;
        setIsPanelOpen(false); // Hide panel before capturing

        try {
            // Wait for panel to disappear from DOM
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(visualizerRef.current, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                scale: 2, // High resolution
            });
            
            const link = document.createElement('a');
            link.download = `mockup-logo-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Không thể xuất ảnh, vui lòng thử lại.');
        } finally {
            setIsPanelOpen(originalPanelState);
            setIsExporting(false);
        }
    };

    const clearLogo = () => {
        setLogoUrl(null);
        setProcessedLogoUrl(null);
    };

    return (
        <>
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end">
                {!isPanelOpen ? (
                    <button 
                        onClick={() => setIsPanelOpen(true)}
                        className="bg-white/90 backdrop-blur border border-blue-200 shadow-sm text-blue-600 px-3 py-2 rounded-lg cursor-pointer hover:bg-blue-50 transition text-sm font-medium flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Demo Logo
                    </button>
                ) : (
                    <div className="bg-white/95 backdrop-blur p-4 rounded-xl shadow-xl border border-blue-100 w-56 text-sm animate-fade-in flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-bold text-gray-700 flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                Demo Logo
                            </span>
                            <button onClick={() => setIsPanelOpen(false)} className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* Upload Button */}
                        <label className="flex items-center justify-center gap-2 w-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition py-2 rounded cursor-pointer font-medium">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            {isProcessing ? 'Đang xử lý...' : (logoUrl ? 'Đổi Logo khác' : 'Tải Logo lên')}
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>

                        {/* Controls (Only show if logo exists) */}
                        {(logoUrl || processedLogoUrl) && (
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 font-medium mb-1 block">Màu Logo</label>
                                    <select 
                                        value={logoColor}
                                        onChange={(e) => setLogoColor(e.target.value as any)}
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-gray-50 outline-none focus:border-blue-400"
                                    >
                                        <option value="original">Màu gốc (Giữ nguyên)</option>
                                        <option value="white">Đổi thành màu Trắng</option>
                                        <option value="black">Đổi thành màu Đen</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-medium mb-1 block">Chế độ hòa trộn</label>
                                    <select 
                                        value={blendMode}
                                        onChange={(e) => setBlendMode(e.target.value as any)}
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-gray-50 outline-none focus:border-blue-400"
                                    >
                                        <option value="normal">Bình thường (Normal)</option>
                                        <option value="multiply">In lên vải (Multiply)</option>
                                        <option value="overlay">Phủ màu (Overlay)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-medium mb-1 flex justify-between">
                                        <span>Độ đục mờ</span>
                                        <span>{Math.round(opacity * 100)}%</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.05" 
                                        value={opacity} 
                                        onChange={(e) => setOpacity(Number(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-medium mb-1 flex justify-between">
                                        <span>Xóa nền trắng (Tolerance)</span>
                                        <span>{255 - removeTolerance}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="200" max="255" step="1" 
                                        value={removeTolerance} 
                                        onChange={(e) => setRemoveTolerance(Number(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Kéo sang trái nếu logo bị sót viền trắng.</p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button 
                                        onClick={clearLogo}
                                        className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-sm font-medium hover:bg-gray-200"
                                    >
                                        Xóa
                                    </button>
                                    <button 
                                        onClick={handleExport}
                                        disabled={isExporting}
                                        className="flex-[2] bg-blue-600 text-white py-1.5 rounded text-sm font-medium hover:bg-blue-700 flex justify-center items-center gap-1"
                                    >
                                        {isExporting ? (
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                                Tải Demo
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* The Draggable Logo Layer */}
            {(processedLogoUrl || logoUrl) && (
                <Rnd
                    default={{
                        x: 150,
                        y: 150,
                        width: 150,
                        height: 150,
                    }}
                    minWidth={50}
                    minHeight={50}
                    bounds="parent"
                    className="z-40 border border-transparent hover:border-blue-400 hover:border-dashed group"
                >
                    <div className="w-full h-full relative">
                        {/* Drag handle overlay to catch pointer events easily */}
                        <div className="absolute inset-0 z-10 cursor-move"></div>
                        
                        <img 
                            src={processedLogoUrl || logoUrl!} 
                            alt="Demo Logo"
                            className="w-full h-full object-contain pointer-events-none"
                            style={{
                                mixBlendMode: blendMode,
                                opacity: opacity,
                                filter: isProcessing ? 'blur(4px) grayscale(100%)' : 'none',
                                transition: 'filter 0.3s'
                            }}
                        />

                        {/* Processing Indicator */}
                        {isProcessing && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 rounded backdrop-blur-[1px]">
                                <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                            </div>
                        )}
                    </div>
                </Rnd>
            )}
        </>
    );
}
