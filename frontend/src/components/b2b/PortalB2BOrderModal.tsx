import React, { useState, useMemo } from 'react';
import { WizardCategoryL1, WizardCategoryL2, WizardCustomizationStep, WizardOption } from './types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    category: WizardCategoryL1;
    subcategory: WizardCategoryL2;
    steps: WizardCustomizationStep[];
    selections: Record<string, string>;
    slug: string;
    token: string;
    onSuccess?: () => void;
}

export default function PortalB2BOrderModal({ isOpen, onClose, onSuccess, slug, token, category, subcategory, steps, selections }: Props) {
    const [quantity, setQuantity] = useState<number>(50);
    const [formData, setFormData] = useState({
        customer_name: '',
        company_name: '',
        phone: '',
        email: '',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Tính toán giá chính xác dựa trên cấu hình và số lượng
    const { exactPrice, totalModifier, selectedOptions } = useMemo(() => {
        let modifier = 0;
        const options: Array<{ step_label: string; option_name: string; modifier: number }> = [];

        for (const step of steps) {
            const optId = selections[step.id];
            const opt = step.options?.find(o => o.id === optId);
            if (opt) {
                modifier += opt.price_modifier;
                options.push({
                    step_label: step.label,
                    option_name: opt.name,
                    modifier: opt.price_modifier
                });
            }
        }

        // Find applicable tier
        let basePrice = 0;
        if (subcategory.price_tiers && subcategory.price_tiers.length > 0) {
            // Sort by min_quantity desc to find the highest applicable tier
            const sortedTiers = [...subcategory.price_tiers].sort((a, b) => b.min_quantity - a.min_quantity);
            const applicableTier = sortedTiers?.find(t => quantity >= t.min_quantity);

            if (applicableTier) {
                basePrice = applicableTier.base_price;
            } else {
                // If quantity is lower than the lowest tier, use the lowest tier's price
                basePrice = sortedTiers[sortedTiers.length - 1].base_price;
            }
        }

        return {
            exactPrice: basePrice + modifier,
            totalModifier: modifier,
            selectedOptions: options
        };
    }, [quantity, steps, selections, subcategory.price_tiers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsSubmitting(true);
        try {
            const apiUrl = (import.meta as any).env?.VITE_API_URL || ((import.meta as any).env?.DEV ? 'http://localhost:3000/api' : '/api');
            const res = await fetch(`${apiUrl}/public/portal/custom-order/${slug}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    category: category.name,
                    subcategory: subcategory.name,
                    quantity,
                    selections: selectedOptions,
                    total_price: exactPrice * quantity,
                    notes: formData.notes
                })
            });

            if (res.ok) {
                setIsSuccess(true);
            } else {
                const data = await res.json();
                alert(data.message || 'Có lỗi xảy ra, vui lòng thử lại sau.');
            }
        } catch (error) {
            alert('Có lỗi mạng, vui lòng thử lại sau.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-slide-up">

                {/* Left: Summary */}
                <div className="bg-gray-50 w-full md:w-6/12 p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">Tóm tắt cấu hình</h3>

                    <div className="mb-6">
                        <p className="text-sm text-gray-500">{category.name}</p>
                        <p className="text-lg font-bold text-primary">{subcategory.name}</p>
                    </div>

                    <div className="space-y-3 mb-8">
                        {selectedOptions.map((opt, idx) => (
                            <div key={idx} className="flex justify-between items-start text-sm">
                                <span className="text-gray-600 w-1/2">{opt.step_label}</span>
                                <span className="font-medium text-right w-1/2">
                                    {opt.option_name}
                                    {opt.modifier > 0 && <span className="text-primary text-xs ml-1">(+{opt.modifier.toLocaleString('vi-VN')}đ)</span>}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Số lượng đặt hàng (bộ)</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="50"
                                max="1000"
                                step="10"
                                value={quantity}
                                onChange={e => setQuantity(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <input
                                type="number"
                                value={quantity}
                                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                                className="w-20 px-2 py-1 text-center font-bold border rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="mt-8 bg-white p-4 rounded-xl border border-primary/20">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-600">Đơn giá:</span>
                            <span className="font-bold">{exactPrice.toLocaleString('vi-VN')}đ/bộ</span>
                        </div>
                        <div className="flex justify-between items-center text-lg mt-2 pt-2 border-t border-gray-100">
                            <span className="font-bold text-gray-800">Tổng tạm tính:</span>
                            <span className="font-bold text-primary text-2xl">{(exactPrice * quantity).toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>
                </div>

                {/* Right: Form */}
                <div className="w-full md:w-6/12 p-6 md:p-8 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                    >
                        ✕
                    </button>

                    {isSuccess ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-4xl mb-4">
                                ✓
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Gửi Yêu Cầu Thành Công!</h2>
                            <p className="text-gray-600 mb-8">
                                Cảm ơn bạn đã quan tâm. Đội ngũ ERP4U sẽ liên hệ lại trong thời gian sớm nhất để tư vấn và gửi mẫu.
                            </p>
                            <button
                                onClick={() => {
                                    onClose();
                                    if (onSuccess) onSuccess();
                                }}
                                className="w-full py-3 bg-primary text-white font-bold rounded-xl"
                            >
                                Đóng Cửa Sổ
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-xl font-bold text-gray-800 mb-6">Yêu cầu báo giá</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú bổ sung</label>
                                    <textarea
                                        rows={3}
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                                        placeholder="Yêu cầu riêng, ngày cần hàng, in logo..."
                                    />
                                </div>

                                <div className="pt-4 flex flex-col gap-3">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full py-3.5 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary/90 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
                                    >
                                        {isSubmitting ? 'ĐANG GỬI...' : 'LƯU CẤU HÌNH & GỬI YÊU CẦU'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const message = `Xin chào, tôi muốn yêu cầu gửi mẫu vải miễn phí cho trường.`;
                                            window.open(`https://zalo.me/0931268685?text=${encodeURIComponent(message)}`, '_blank');
                                        }}
                                        className="w-full py-3 bg-white text-gray-700 border-2 border-gray-200 rounded-xl font-semibold hover:border-gray-300 hover:bg-gray-50 transition"
                                    >
                                        YÊU CẦU GỬI MẪU VẢI MIỄN PHÍ
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
