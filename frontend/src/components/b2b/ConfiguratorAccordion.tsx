import React, { useState } from 'react';
import { WizardCustomizationStep, WizardOption } from './types';
import { resolveGoogleDriveUrl } from './utils';

const getApiBaseUrl = () => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:3000';
    return base.endsWith('/api') ? base.replace(/\/api$/, '') : base;
};

const resolveImageUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('/uploads/')) return `${getApiBaseUrl()}/api/upload/files/${url.replace('/uploads/', '')}`;
    return resolveGoogleDriveUrl(url);
};

interface Props {
    steps: WizardCustomizationStep[];
    selections: Record<string, string>;
    onChange: (stepId: string, optionId: string) => void;
    skippedSteps?: Record<string, boolean>;
    onSkip?: (stepId: string) => void;
    imageSelections?: Record<string, number>;
    onImageSelect?: (optionId: string, imageIndex: number) => void;
}

export default function ConfiguratorAccordion({ steps, selections, onChange, skippedSteps = {}, onSkip, imageSelections = {}, onImageSelect }: Props) {
    const [openStep, setOpenStep] = useState<string>(steps[0]?.id || '');

    const handleSelect = (stepId: string, optionId: string) => {
        onChange(stepId, optionId);
    };

    const handleSkip = (stepId: string) => {
        onSkip?.(stepId);
    };

    // Render multi-image gallery thumbnails for an option
    const renderImageGallery = (opt: WizardOption) => {
        if (!opt.image_urls || opt.image_urls.length === 0) return null;
        const selectedIdx = imageSelections[opt.id] ?? 0;

        return (
            <div className="flex flex-wrap gap-2 mt-2 ml-8">
                {opt.image_urls.map((url, idx) => (
                    <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); onImageSelect?.(opt.id, idx); }}
                        className={`w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${
                            selectedIdx === idx
                                ? 'border-primary shadow-md scale-105'
                                : 'border-gray-200 hover:border-gray-300 hover:scale-102'
                        }`}
                    >
                        <img
                            src={resolveImageUrl(url)}
                            alt={`${opt.name} - ${idx + 1}`}
                            className="w-full h-full object-contain bg-white"
                        />
                    </button>
                ))}
            </div>
        );
    };

    const renderOptionUI = (step: WizardCustomizationStep) => {
        const selectedId = selections[step.id];
        const isSkipped = skippedSteps[step.id];

        if (isSkipped) {
            return (
                <div className="text-center py-4">
                    <p className="text-gray-400 text-sm mb-2">Bước này đã được bỏ qua</p>
                    <button
                        onClick={() => onSkip?.(step.id)}
                        className="text-primary text-sm underline hover:no-underline"
                    >
                        Chọn lại
                    </button>
                </div>
            );
        }

        // YES/NO (Ẩn/Hiện) type
        if (step.type === 'yes_no') {
            return (
                <div className="flex gap-3">
                    {(step.options || []).map(opt => {
                        const isYes = opt.id === (step.options?.[0]?.id);
                        return (
                            <button
                                key={opt.id}
                                onClick={() => handleSelect(step.id, opt.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 font-semibold transition-all ${
                                    selectedId === opt.id
                                        ? isYes
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-red-400 bg-red-50 text-red-600'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <span className="text-lg">{isYes ? '✓' : '✗'}</span>
                                {opt.name}
                                {opt.price_modifier > 0 && <span className="text-xs text-gray-400 ml-1">+{(Number(opt.price_modifier) / 1000)}k</span>}
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (step.type === 'toggle') {
            return (
                <div className="flex flex-wrap gap-2">
                    {(step.options || []).map(opt => (
                        <div key={opt.id}>
                            <button
                                onClick={() => handleSelect(step.id, opt.id)}
                                className={`px-4 py-2 rounded-full border-2 font-medium transition-all ${
                                    selectedId === opt.id
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                {opt.name} {opt.price_modifier > 0 && <span className="text-xs text-gray-400 block">+{(Number(opt.price_modifier) / 1000)}k</span>}
                            </button>
                            {selectedId === opt.id && renderImageGallery(opt)}
                        </div>
                    ))}
                </div>
            );
        }

        if (step.type === 'color_swatch') {
            return (
                <div className="flex flex-wrap gap-3">
                    {(step.options || []).map(opt => (
                        <div key={opt.id}>
                            <button
                                onClick={() => handleSelect(step.id, opt.id)}
                                title={opt.name}
                                className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center p-1 ${
                                    selectedId === opt.id
                                        ? 'border-primary scale-110 shadow-md'
                                        : 'border-transparent hover:scale-105'
                                }`}
                                style={{ 
                                    backgroundColor: opt.color_code || '#ddd'
                                }}
                            >
                                {selectedId === opt.id && (
                                    <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold drop-shadow-md">
                                        ✓
                                    </div>
                                )}
                            </button>
                            {selectedId === opt.id && renderImageGallery(opt)}
                        </div>
                    ))}
                </div>
            );
        }

        if (step.type === 'branding') {
            return (
                <div className="flex flex-col gap-2">
                    {(step.options || []).map(opt => (
                        <div key={opt.id}>
                            <label
                                className={`flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                                    selectedId === opt.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                }`}
                                onClick={() => handleSelect(step.id, opt.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        selectedId === opt.id ? 'border-primary' : 'border-gray-300'
                                    }`}>
                                        {selectedId === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {opt.image_url && (
                                            <img src={resolveImageUrl(opt.image_url)} alt={opt.name} className="w-8 h-8 object-contain rounded" />
                                        )}
                                        <div>
                                            <span className="font-medium text-gray-800 block">{opt.name}</span>
                                            {opt.description && <span className="text-xs text-gray-500 block">{opt.description}</span>}
                                        </div>
                                    </div>
                                </div>
                                {opt.price_modifier > 0 && (
                                    <span className="text-sm font-semibold text-primary">
                                        +{Number(opt.price_modifier).toLocaleString('vi-VN')}đ
                                    </span>
                                )}
                            </label>
                            {selectedId === opt.id && renderImageGallery(opt)}
                        </div>
                    ))}
                </div>
            );
        }

        // Default: dropdown
        return (
            <div className="flex flex-col gap-2">
                {(step.options || []).map(opt => (
                    <div key={opt.id}>
                        <label
                            className={`flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                                selectedId === opt.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => handleSelect(step.id, opt.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    selectedId === opt.id ? 'border-primary' : 'border-gray-300'
                                }`}>
                                    {selectedId === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                </div>
                                <div>
                                    <span className="font-medium text-gray-800 block">{opt.name}</span>
                                    {opt.description && <span className="text-xs text-gray-500 block">{opt.description}</span>}
                                </div>
                            </div>
                            {opt.price_modifier > 0 && (
                                <span className="text-sm font-semibold text-primary">
                                    +{Number(opt.price_modifier).toLocaleString('vi-VN')}đ
                                </span>
                            )}
                        </label>
                        {selectedId === opt.id && renderImageGallery(opt)}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="border border-primary/20 rounded-xl overflow-hidden bg-white shadow-sm">
            {steps.map((step, index) => {
                const isOpen = openStep === step.id;
                const selectedOption = step.options?.find(o => o.id === selections[step.id]);
                const isSkipped = skippedSteps[step.id];

                return (
                    <div key={step.id} className="border-b border-gray-100 last:border-b-0">
                        <button
                            onClick={() => setOpenStep(isOpen ? '' : step.id)}
                            className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                                isOpen ? 'bg-primary/5' : 'hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    isSkipped ? 'bg-gray-200 text-gray-400' :
                                    isOpen ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {isSkipped ? '—' : `B${index + 1}`}
                                </div>
                                <div>
                                    <h3 className={`font-semibold ${isSkipped ? 'text-gray-400 line-through' : isOpen ? 'text-primary' : 'text-gray-800'}`}>
                                        {step.label}
                                        {step.is_skippable && <span className="text-xs text-gray-400 font-normal ml-2">(tùy chọn)</span>}
                                    </h3>
                                    {!isOpen && !isSkipped && selectedOption && (
                                        <p className="text-sm text-gray-500 mt-0.5">{selectedOption.name}</p>
                                    )}
                                    {!isOpen && isSkipped && (
                                        <p className="text-sm text-gray-400 mt-0.5 italic">Đã bỏ qua</p>
                                    )}
                                </div>
                            </div>
                            <div className="text-gray-400">
                                {isOpen ? '▲' : '▼'}
                            </div>
                        </button>
                        
                        {isOpen && (
                            <div className="p-4 pt-2 bg-white animate-fade-in">
                                {renderOptionUI(step)}
                                {step.is_skippable && !isSkipped && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                                        <button
                                            onClick={() => handleSkip(step.id)}
                                            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            ↓ Bỏ qua bước này
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
