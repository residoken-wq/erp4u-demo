import React from 'react';
import { WizardCategoryL1, WizardCategoryL2 } from './types';
import { resolveGoogleDriveUrl } from './utils';

interface Props {
    categories: WizardCategoryL1[];
    selectedL1: string;
    selectedL2: string;
    onSelectL1: (id: string) => void;
    onSelectL2: (id: string) => void;
}

export default function CategoryFunnel({ categories, selectedL1, selectedL2, onSelectL1, onSelectL2 }: Props) {
    const currentL1 = categories?.find(c => c.id === selectedL1);

    return (
        <div className="mb-8">
            {/* L1 Categories */}
            <div className="flex flex-wrap justify-center gap-4 mb-6">
                {categories.map(c => (
                    <div
                        key={c.id}
                        onClick={() => onSelectL1(c.id)}
                        className={`cursor-pointer flex flex-col items-center p-4 rounded-xl border-2 transition-all w-40 text-center ${
                            selectedL1 === c.id
                                ? 'border-primary bg-primary/10 shadow-md'
                                : 'border-transparent bg-white hover:border-gray-200 shadow-sm'
                        }`}
                    >
                        {c.image_url ? (
                            <img src={resolveGoogleDriveUrl(c.image_url)} alt={c.name} className="w-20 h-20 object-contain mb-2" />
                        ) : c.icon_url ? (
                            <img src={resolveGoogleDriveUrl(c.icon_url)} alt={c.name} className="w-16 h-16 object-contain mb-2" />
                        ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2 text-2xl">📦</div>
                        )}
                        <span className={`font-semibold text-sm ${selectedL1 === c.id ? 'text-primary' : 'text-gray-700'}`}>
                            {c.name}
                        </span>
                    </div>
                ))}
            </div>

            {/* L2 Categories (Tabs) */}
            {currentL1 && currentL1.subcategories.length > 0 && (
                <div className="flex justify-center border-b border-gray-200">
                    <div className="flex overflow-x-auto gap-1 px-4 scrollbar-hide">
                        {currentL1.subcategories.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => onSelectL2(sub.id)}
                                className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                                    selectedL2 === sub.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {sub.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
