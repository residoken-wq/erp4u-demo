import React from 'react';
import { WizardCategoryL2, WizardCustomizationStep } from './types';

interface Props {
    subcategory: WizardCategoryL2;
    steps: WizardCustomizationStep[];
    selections: Record<string, string>;
    skippedSteps?: Record<string, boolean>;
}

export default function SelectionSummary({ subcategory, steps, selections, skippedSteps = {} }: Props) {
    // Collect selected options for display
    const summaryItems = steps.map((step, index) => {
        const isSkipped = skippedSteps[step.id];
        const selectedOptionId = selections[step.id];
        const selectedOption = step.options?.find(o => o.id === selectedOptionId);

        return {
            stepIndex: index + 1,
            stepLabel: step.label,
            isSkipped,
            optionName: selectedOption?.name || '—',
            priceModifier: Number(selectedOption?.price_modifier || 0),
        };
    });

    const hasAnySelection = summaryItems.some(item => !item.isSkipped && item.optionName !== '—');

    if (!hasAnySelection && !subcategory.description) return null;

    return (
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <span>📋</span>
                    Tóm tắt lựa chọn
                </h3>
            </div>

            <div className="p-4 space-y-3">
                {/* Product description */}
                {subcategory.description && (
                    <div className="pb-3 border-b border-gray-100">
                        <p className="text-sm text-gray-600 leading-relaxed">{subcategory.description}</p>
                    </div>
                )}

                {/* Selection timeline */}
                {hasAnySelection && (
                    <div className="space-y-2">
                        {summaryItems.map((item) => (
                            <div
                                key={item.stepIndex}
                                className={`flex items-center gap-3 py-1.5 transition-all ${
                                    item.isSkipped ? 'opacity-40' : ''
                                }`}
                            >
                                {/* Step number badge */}
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    item.isSkipped
                                        ? 'bg-gray-100 text-gray-400'
                                        : 'bg-primary/10 text-primary'
                                }`}>
                                    {item.isSkipped ? '—' : `${item.stepIndex}`}
                                </div>

                                {/* Step label */}
                                <span className={`text-sm flex-1 ${
                                    item.isSkipped ? 'text-gray-400 line-through' : 'text-gray-600'
                                }`}>
                                    {item.stepLabel}
                                </span>

                                {/* Arrow */}
                                {!item.isSkipped && (
                                    <span className="text-gray-300 text-xs">→</span>
                                )}

                                {/* Selected option */}
                                {!item.isSkipped ? (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-semibold text-gray-800">{item.optionName}</span>
                                        {item.priceModifier > 0 && (
                                            <span className="text-xs text-primary font-medium">
                                                (+{Number(item.priceModifier).toLocaleString('vi-VN')}đ)
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs text-gray-400 italic">Bỏ qua</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
